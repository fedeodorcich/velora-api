import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../src/modules/users/entities/user.entity.js';
import { BillingWebhookJob } from '../src/modules/billing/entities/billing-webhook-job.entity.js';
import { SubscriptionPayment } from '../src/modules/billing/entities/subscription-payment.entity.js';
import { MercadoPagoWebhookService } from '../src/modules/billing/mercado-pago-webhook.service.js';
import { API, createE2eApp, registerUser, resetDatabase, type TestSession } from './support/e2e-app.js';

const subscriptionId = 'a309951b87244621b1d10cd1231614dd';
const endpoint = `${API}/billing/mercado-pago/webhook`;
const collector = 3858452334;
const secret = 'e2e-webhook-secret';

describe('Webhooks de suscripción', () => {
  let app: INestApplication;
  let db: DataSource;
  let session: TestSession;
  let worker: MercadoPagoWebhookService;
  let subscriptionStatus: string;
  let paymentStatus: string;
  let approvedAt: string;
  let refunded: number;
  let paymentOwner: string;
  const remote = vi.fn();

  function subscription() {
    return {
      id: subscriptionId,
      external_reference: session.user.id,
      collector_id: collector,
      status: subscriptionStatus,
      auto_recurring: { transaction_amount: 2500, currency_id: 'ARS', frequency: 1, frequency_type: 'months' },
    };
  }

  function payment(id: string) {
    return {
      id: Number(id),
      external_reference: paymentOwner,
      collector_id: collector,
      status: paymentStatus,
      transaction_amount: 2500,
      transaction_amount_refunded: refunded,
      currency_id: 'ARS',
      date_approved: approvedAt,
      point_of_interaction: { transaction_data: { subscription_id: subscriptionId } },
    };
  }

  async function notify(topic: string, id: string, signatureOverride?: string) {
    const ts = String(Date.now());
    const signature = createHmac('sha256', secret)
      .update(`id:${id.toLowerCase()};request-id:req-e2e;ts:${ts};`).digest('hex');
    return request(app.getHttpServer()).post(endpoint)
      .query({ 'data.id': id })
      .set('x-request-id', 'req-e2e')
      .set('x-signature', signatureOverride ?? `ts=${ts},v1=${signature}`)
      .send({ type: topic, data: { id }, live_mode: true, action: 'updated', api_version: 'v1' });
  }

  async function automaticUntil() {
    return (await db.getRepository(User).findOneOrFail({
      where: { id: session.user.id },
      select: { id: true, mpProUntil: true },
    })).mpProUntil;
  }

  beforeAll(async () => {
    app = await createE2eApp();
    db = app.get(DataSource);
    worker = app.get(MercadoPagoWebhookService);
  });

  beforeEach(async () => {
    await resetDatabase(app);
    session = await registerUser(app, { email: 'buyer-webhook@velora.test' });
    await db.getRepository(User).update({ id: session.user.id }, {
      mpTestCheckoutUrl: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_id=${subscriptionId}`,
    });
    subscriptionStatus = 'authorized';
    paymentStatus = 'approved';
    approvedAt = '2030-01-31T12:00:00Z';
    refunded = 0;
    paymentOwner = session.user.id;
    remote.mockReset();
    remote.mockImplementation(async (url: string) => {
      const path = new URL(url).pathname;
      if (path.startsWith('/v1/payments/')) {
        return new Response(JSON.stringify(payment(path.split('/').pop()!)), { status: 200 });
      }
      if (path.startsWith('/authorized_payments/')) {
        return new Response(JSON.stringify({ payment: { id: 123 } }), { status: 200 });
      }
      return new Response(JSON.stringify(subscription()), { status: 200 });
    });
    vi.stubGlobal('fetch', remote);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('rechaza firmas falsas y cuerpos sin identificador antes de guardar', async () => {
    const bad = await notify('payment', '123', 'ts=1,v1=' + '0'.repeat(64));
    expect(bad.status).toBe(401);
    await request(app.getHttpServer()).post(endpoint).send({ type: 'payment' }).expect(400);
    expect(await db.getRepository(BillingWebhookJob).count()).toBe(0);
    expect(remote).not.toHaveBeenCalled();
  });

  it('responde tras guardar y activa Pro una sola vez bajo notificaciones duplicadas', async () => {
    const responses = await Promise.all([notify('payment', '123'), notify('payment', '123')]);
    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(remote).not.toHaveBeenCalled();
    await Promise.all([worker.processNext(), worker.processNext()]);
    expect(await automaticUntil()).toEqual(new Date('2030-02-28T12:00:00Z'));
    await notify('payment', '123');
    await worker.processNext();
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(1);
    expect(await automaticUntil()).toEqual(new Date('2030-02-28T12:00:00Z'));

    const plan = await request(app.getHttpServer()).get(`${API}/billing`).set(session.auth).expect(200);
    expect(plan.body.plan).toBe('pro');
    expect(plan.body.proUntil).toBe('2030-02-28T12:00:00.000Z');
    const logo = 'data:image/png;base64,iVBORw0KGgo=';
    await request(app.getHttpServer()).put(`${API}/billing/quote-logo`)
      .set(session.auth).send({ dataUrl: logo }).expect(204);
    for (let index = 0; index < 6; index += 1) {
      await request(app.getHttpServer()).post(`${API}/clients`).set(session.auth)
        .send({ name: 'Cliente Pro', email: 'cliente@velora.test', status: 'activo' }).expect(201);
    }
  });

  it('autorizar o cancelar una suscripción conserva el período ya pagado', async () => {
    await notify('subscription_preapproval', subscriptionId);
    await worker.processNext();
    expect(await automaticUntil()).toBeNull();
    await notify('payment', '123');
    await worker.processNext();
    subscriptionStatus = 'cancelled';
    await notify('subscription_preapproval', subscriptionId);
    await worker.processNext();
    expect(await automaticUntil()).toEqual(new Date('2030-02-28T12:00:00Z'));
  });

  it('procesa renovaciones y avisos atrasados sin acumular meses duplicados', async () => {
    approvedAt = '2030-03-31T12:00:00Z';
    await notify('payment', '456');
    await worker.processNext();
    approvedAt = '2030-01-31T12:00:00Z';
    await notify('subscription_authorized_payment', '789');
    await worker.processNext();
    expect(await automaticUntil()).toEqual(new Date('2030-04-30T12:00:00Z'));
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(2);
  });

  it('revierte el acceso automático ante reembolso y conserva la vigencia manual', async () => {
    await db.getRepository(User).update({ id: session.user.id }, { proUntil: new Date('2031-01-01T00:00:00Z') });
    await notify('payment', '123');
    await worker.processNext();
    paymentStatus = 'refunded';
    refunded = 2500;
    await notify('payment', '123');
    await worker.processNext();
    expect(await automaticUntil()).toBeNull();
    const plan = await request(app.getHttpServer()).get(`${API}/billing`).set(session.auth).expect(200);
    expect(plan.body.proUntil).toBe('2031-01-01T00:00:00.000Z');
  });

  it('conserva el trabajo pendiente ante una falla del proveedor y lo reintenta', async () => {
    remote.mockRejectedValueOnce(new Error('Falla temporal'));
    await notify('payment', '123');
    await worker.processNext();
    const job = await db.getRepository(BillingWebhookJob).findOneByOrFail({ id: 'payment:123' });
    expect(job.pending).toBe(true);
    expect(job.attempts).toBe(1);
    await db.getRepository(BillingWebhookJob).update({ id: job.id }, { nextAttemptAt: new Date(0) });
    await worker.processNext();
    expect(await automaticUntil()).toEqual(new Date('2030-02-28T12:00:00Z'));
  });

  it('no concede acceso con una referencia ajena aunque el mensaje esté firmado', async () => {
    paymentOwner = '00000000-0000-4000-8000-000000000000';
    await notify('payment', '123');
    await worker.processNext();
    expect(await automaticUntil()).toBeNull();
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(0);
  });
});
