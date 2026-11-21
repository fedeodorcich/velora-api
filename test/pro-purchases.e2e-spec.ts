import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Payment, Preference } from 'mercadopago';
import request from 'supertest';
import { DataSource } from 'typeorm';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { User } from '../src/modules/users/entities/user.entity.js';
import { ProPurchase } from '../src/modules/billing/entities/pro-purchase.entity.js';
import { SubscriptionPayment } from '../src/modules/billing/entities/subscription-payment.entity.js';
import { MercadoPagoWebhookService } from '../src/modules/billing/mercado-pago-webhook.service.js';
import {
  API,
  createE2eApp,
  registerUser,
  resetDatabase,
  type TestSession,
} from './support/e2e-app.js';

const base = `${API}/billing/mercado-pago`;

describe('Compra de un mes Pro sin renovación automática', () => {
  let app: INestApplication;
  let db: DataSource;
  let session: TestSession;
  let reference: string;
  let status: string;
  let seller: number;
  let amount: number;
  let refund: number;
  let approvedAt: string | null;
  let preferenceCalls: number;
  let preferenceFailure: boolean;

  beforeAll(async () => {
    app = await createE2eApp();
    db = app.get(DataSource);
  });
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(async () => {
    await resetDatabase(app);
    session = await registerUser(app, { email: 'buyer-webhook@velora.test' });
    reference = '';
    status = 'approved';
    seller = 3858452334;
    amount = 2500;
    refund = 0;
    approvedAt = new Date().toISOString();
    preferenceCalls = 0;
    preferenceFailure = false;
    vi.spyOn(Preference.prototype, 'create').mockImplementation(
      async ({ body }) => {
        preferenceCalls++;
        if (preferenceFailure) throw new Error('Provider unavailable');
        expect(body.items?.[0]).toMatchObject({
          quantity: 1,
          unit_price: 2500,
          currency_id: 'ARS',
        });
        expect(body).not.toHaveProperty('auto_recurring');
        reference = body.external_reference ?? '';
        expect(body.back_urls?.success).toContain(
          `purchase=${reference.slice('velora-pro:'.length)}`,
        );
        return {
          id: 'test-preference',
          init_point:
            'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=test-preference',
        } as Awaited<ReturnType<Preference['create']>>;
      },
    );
    vi.spyOn(Payment.prototype, 'get').mockImplementation(
      async ({ id }) =>
        providerPayment(String(id)) as Awaited<ReturnType<Payment['get']>>,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function providerPayment(id: string) {
    return {
      id: Number(id),
      external_reference: reference,
      collector_id: seller,
      status,
      transaction_amount: amount,
      transaction_amount_refunded: refund,
      currency_id: 'ARS',
      date_approved: approvedAt,
    };
  }
  const monthsLater = (value: string) => {
    const d = new Date(value);
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    d.setUTCDate(
      Math.min(
        day,
        new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
        ).getUTCDate(),
      ),
    );
    return d;
  };
  const checkout = () =>
    request(app.getHttpServer()).post(`${base}/purchases`).set(session.auth);
  const refresh = (id: string, paymentId = '123') =>
    request(app.getHttpServer())
      .post(`${base}/purchases/${id}/refresh`)
      .set(session.auth)
      .send({ paymentId });
  const plan = () =>
    request(app.getHttpServer()).get(`${API}/billing`).set(session.auth);

  it('crea un único checkout concurrente, fija precio en servidor y restringe cuentas', async () => {
    const responses = await Promise.all([checkout(), checkout()]);
    expect(responses.map((r) => r.status)).toEqual([200, 200]);
    expect(responses[0].body).toEqual(responses[1].body);
    expect(preferenceCalls).toBe(1);
    expect(await db.getRepository(ProPurchase).count()).toBe(1);
    expect((await plan().expect(200)).body.oneTimeOffer).toMatchObject({
      amount: 2500,
      currency: 'ARS',
      months: 1,
      test: true,
    });
    const other = await registerUser(app);
    await request(app.getHttpServer())
      .post(`${base}/purchases`)
      .set(other.auth)
      .expect(403);
    await request(app.getHttpServer()).post(`${base}/purchases`).expect(401);
    await request(app.getHttpServer())
      .post(`${base}/test-checkout`)
      .set(session.auth)
      .expect(403);
  });

  it('habilita exactamente un mes y no lo duplica al refrescar ni con otro pago de la misma compra', async () => {
    const purchase = await checkout().expect(200);
    expect((await plan().expect(200)).body.plan).toBe('free');
    const response = await refresh(purchase.body.id).expect(200);
    expect(response.body.status).toBe('approved');
    expect(response.body.validUntil).toBe(
      monthsLater(approvedAt!).toISOString(),
    );
    await refresh(purchase.body.id).expect(200);
    const second = await refresh(purchase.body.id, '124').expect(200);
    expect(second.body.validUntil).toBe(response.body.validUntil);
    expect((await plan().expect(200)).body).toMatchObject({
      plan: 'pro',
      proUntil: response.body.validUntil,
    });
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(2);
  });

  it('extiende desde el vencimiento si ya tiene Pro y conserva fin de mes', async () => {
    await db
      .getRepository(User)
      .update(
        { id: session.user.id },
        { proUntil: new Date('2030-01-31T12:00:00Z') },
      );
    const purchase = await checkout().expect(200);
    expect((await refresh(purchase.body.id).expect(200)).body.validUntil).toBe(
      '2030-02-28T12:00:00.000Z',
    );
  });

  it('un segundo pago voluntario suma otro mes con una compra distinta', async () => {
    const first = await checkout().expect(200);
    const paid = await refresh(first.body.id).expect(200);
    const second = await checkout().expect(200);
    expect(second.body.id).not.toBe(first.body.id);
    expect(
      (await refresh(second.body.id, '456').expect(200)).body.validUntil,
    ).toBe(monthsLater(paid.body.validUntil).toISOString());
  });

  it('pendiente o rechazado no concede Pro', async () => {
    const purchase = await checkout().expect(200);
    status = 'pending';
    approvedAt = null;
    expect((await refresh(purchase.body.id).expect(200)).body.status).toBe(
      'pending',
    );
    expect((await plan().expect(200)).body.plan).toBe('free');
    status = 'rejected';
    expect((await refresh(purchase.body.id).expect(200)).body.status).toBe(
      'rejected',
    );
    expect((await plan().expect(200)).body.plan).toBe('free');
  });

  it('reembolso revoca la concesión automática y respeta una activación manual', async () => {
    const purchase = await checkout().expect(200);
    await refresh(purchase.body.id).expect(200);
    refund = 2500;
    status = 'refunded';
    expect((await refresh(purchase.body.id).expect(200)).body.status).toBe(
      'refunded',
    );
    expect((await plan().expect(200)).body.plan).toBe('free');
    await db
      .getRepository(User)
      .update(
        { id: session.user.id },
        { proUntil: new Date('2030-01-01T00:00:00Z') },
      );
    await refresh(purchase.body.id).expect(200);
    expect((await plan().expect(200)).body.proUntil).toBe(
      '2030-01-01T00:00:00.000Z',
    );
  });

  it('comprueba vendedor e importe y rechaza IDs ajenos aunque el retorno diga aprobado', async () => {
    const purchase = await checkout().expect(200);
    seller = 999;
    await refresh(purchase.body.id).expect(403);
    seller = 3858452334;
    amount = 1;
    await refresh(purchase.body.id).expect(403);
    amount = 2500;
    const saved = reference;
    reference = 'velora-pro:00000000-0000-4000-8000-000000000000';
    await refresh(purchase.body.id).expect(403);
    reference = saved;
    const other = await registerUser(app);
    await request(app.getHttpServer())
      .post(`${base}/purchases/${purchase.body.id}/refresh`)
      .set(other.auth)
      .send({ paymentId: '123' })
      .expect(404);
    await refresh(purchase.body.id, 'invalid').expect(400);
    expect((await plan().expect(200)).body.plan).toBe('free');
  });

  it('procesa webhook firmado en cola y admite repetición y devolución', async () => {
    const purchase = await checkout().expect(200);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(providerPayment('123')), { status: 200 }),
      ),
    );
    const notify = (signature?: string) => {
      const ts = String(Date.now());
      const hmac = createHmac('sha256', 'e2e-webhook-secret')
        .update(`id:123;request-id:purchase-test;ts:${ts};`)
        .digest('hex');
      return request(app.getHttpServer())
        .post(`${base}/webhook`)
        .query({ 'data.id': '123' })
        .set('x-request-id', 'purchase-test')
        .set('x-signature', signature ?? `ts=${ts},v1=${hmac}`)
        .send({ type: 'payment', data: { id: '123' } });
    };
    await notify('ts=1,v1=' + '0'.repeat(64)).expect(401);
    await notify().expect(200);
    await app.get(MercadoPagoWebhookService).processNext();
    const first = (await plan().expect(200)).body.proUntil;
    await notify().expect(200);
    await app.get(MercadoPagoWebhookService).processNext();
    expect((await plan().expect(200)).body.proUntil).toBe(first);
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(1);
    refund = 2500;
    status = 'refunded';
    await notify().expect(200);
    await app.get(MercadoPagoWebhookService).processNext();
    expect((await plan().expect(200)).body.plan).toBe('free');
    expect(
      (
        await request(app.getHttpServer())
          .get(`${base}/purchases/latest`)
          .set(session.auth)
          .expect(200)
      ).body,
    ).toMatchObject({ id: purchase.body.id, status: 'refunded' });
  });

  it('rollback si falla el proveedor y permite nuevo checkout cuando vence', async () => {
    preferenceFailure = true;
    await checkout().expect(502);
    expect(await db.getRepository(ProPurchase).count()).toBe(0);
    preferenceFailure = false;
    const purchase = await checkout().expect(200);
    await db
      .getRepository(ProPurchase)
      .update(
        { id: purchase.body.id, userId: session.user.id },
        { expiresAt: new Date(0) },
      );
    expect(
      (
        await request(app.getHttpServer())
          .get(`${base}/purchases/latest`)
          .set(session.auth)
          .expect(200)
      ).body.status,
    ).toBe('expired');
    expect((await checkout().expect(200)).body.id).not.toBe(purchase.body.id);
  });
});
