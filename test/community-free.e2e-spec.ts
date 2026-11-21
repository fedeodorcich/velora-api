import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Preference } from 'mercadopago';
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
import {
  API,
  createE2eApp,
  registerUser,
  resetDatabase,
} from './support/e2e-app.js';
import { User } from '../src/modules/users/entities/user.entity.js';
import { ContactRequest } from '../src/modules/community/contact-request.entity.js';
import { MercadoPagoWebhookService } from '../src/modules/billing/mercado-pago-webhook.service.js';
import { SubscriptionPayment } from '../src/modules/billing/entities/subscription-payment.entity.js';
const settings = vi.hoisted(() => ({ supportEmail: 'support@velora.test' }));
vi.mock('../src/core/config/env.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/core/config/env.js')>();
  return {
    env: {
      ...original.env,
      billing: { ...original.env.billing, membershipsEnabled: false },
      community: {
        contactEnabled: true,
        get supportEmail() {
          return settings.supportEmail;
        },
        donationUrl: '',
        donationsEnabled: false,
        donationTestEnabled: true,
      },
    },
  };
});
const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+6kAAAAASUVORK5CYII=';

describe('Funciones gratuitas, aportes y contacto', () => {
  let app: INestApplication;
  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
  });
  beforeEach(() => {
    settings.supportEmail = 'support@velora.test';
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  afterAll(async () => {
    await app?.close();
  });

  it('permite seis clientes activos, todas las altas y el logo sin membresía', async () => {
    const session = await registerUser(app);
    const server = app.getHttpServer();
    const plan = await request(server)
      .get(`${API}/billing`)
      .set(session.auth)
      .expect(200);
    expect(plan.body).toMatchObject({
      plan: 'free',
      membershipsEnabled: false,
      activeClientLimit: null,
      checkout: null,
      oneTimeOffer: null,
    });
    let lastId = '';
    for (let i = 0; i < 6; i++) {
      const r = await request(server)
        .post(`${API}/clients`)
        .set(session.auth)
        .send({
          name: `Cliente ${i}`,
          email: `cliente${i}@velora.test`,
          status: 'activo',
        })
        .expect(201);
      lastId = r.body.id as string;
    }
    const access = await request(server)
      .get(`${API}/clients/creation-access`)
      .set(session.auth)
      .expect(200);
    expect(access.body.clientIds).toBeNull();
    const quote = await request(server)
      .post(`${API}/quotes`)
      .set(session.auth)
      .send({
        clientId: lastId,
        title: 'Servicio acordado',
        status: 'aceptado',
        items: [{ description: 'Trabajo', quantity: 1, unitPrice: 100 }],
      })
      .expect(201);
    const project = await request(server)
      .post(`${API}/projects`)
      .set(session.auth)
      .send({ quoteId: quote.body.id })
      .expect(201);
    await request(server)
      .post(`${API}/payments`)
      .set(session.auth)
      .send({
        projectId: project.body.id,
        concept: 'Pago acordado',
        amount: 100,
        dueDate: '2027-01-01',
      })
      .expect(201);
    await request(server)
      .put(`${API}/billing/quote-logo`)
      .set(session.auth)
      .send({ dataUrl: LOGO })
      .expect(204);
    expect(
      (
        await request(server)
          .get(`${API}/billing`)
          .set(session.auth)
          .expect(200)
      ).body.quoteLogo,
    ).toBe(LOGO);
    await request(server)
      .post(`${API}/billing/mercado-pago/purchases`)
      .set(session.auth)
      .expect(403);
    await request(server)
      .post(`${API}/billing/interest`)
      .set(session.auth)
      .expect(403);
  }, 60000);

  it('registra una consulta con consentimiento, valida datos y limita repeticiones', async () => {
    const server = app.getHttpServer();
    const dto = {
      name: 'Persona de prueba',
      email: 'contact-test@velora.test',
      subject: 'consulta',
      message: 'Quisiera consultar sobre los presupuestos.',
      privacyAccepted: true,
      website: '',
    };
    await request(server)
      .post(`${API}/community/contact`)
      .send({ ...dto, privacyAccepted: false })
      .expect(400);
    await request(server)
      .post(`${API}/community/contact`)
      .send({ ...dto, email: 'invalido' })
      .expect(400);
    await request(server)
      .post(`${API}/community/contact`)
      .send({ ...dto, website: 'spam.example' })
      .expect(403);
    const r = await request(server)
      .post(`${API}/community/contact`)
      .send(dto)
      .expect(201);
    expect(r.body.id).toBeTypeOf('string');
    expect(r.body).not.toHaveProperty('email');
    const saved = await app
      .get(DataSource)
      .getRepository(ContactRequest)
      .findOneByOrFail({ id: r.body.id as string });
    expect(saved.message).toBe(dto.message);
    await request(server)
      .post(`${API}/community/contact`)
      .send(dto)
      .expect(429);
  });

  it('no acepta ni promete envíos mientras falta el correo de soporte', async () => {
    settings.supportEmail = '';
    const config = await request(app.getHttpServer())
      .get(`${API}/community/config`)
      .expect(200);
    expect(config.body).toMatchObject({
      contactEnabled: false,
      supportEmail: null,
      donationUrl: null,
    });
    await request(app.getHttpServer())
      .post(`${API}/community/contact`)
      .send({
        name: 'Persona',
        email: 'other@velora.test',
        subject: 'consulta',
        message: 'Mensaje de prueba válido',
        privacyAccepted: true,
      })
      .expect(503);
  });

  it('crea una donación de prueba separada y nunca concede Pro', async () => {
    const session = await registerUser(app, {
      email: 'buyer-webhook@velora.test',
    });
    let reference = '';
    const create = vi
      .spyOn(Preference.prototype, 'create')
      .mockImplementation(async ({ body }) => {
        reference = body.external_reference ?? '';
        expect(reference).toMatch(/^velora-donation:/);
        expect(body.items?.[0]).toMatchObject({
          unit_price: 1000,
          title: 'Donación voluntaria a VeloraCRM · sin contraprestación',
        });
        expect(body).not.toHaveProperty('auto_recurring');
        return {
          id: 'donation-pref',
          init_point:
            'https://www.mercadopago.com.ar/checkout/v1/redirect?pref_id=donation-pref',
        } as Awaited<ReturnType<Preference['create']>>;
      });
    await request(app.getHttpServer())
      .post(`${API}/community/donations/test-checkout`)
      .set(session.auth)
      .send({ amount: 1000 })
      .expect(200);
    expect(create).toHaveBeenCalledTimes(1);
    await request(app.getHttpServer())
      .post(`${API}/community/donations/test-checkout`)
      .set(session.auth)
      .send({ amount: 1 })
      .expect(400);
    const other = await registerUser(app);
    await request(app.getHttpServer())
      .post(`${API}/community/donations/test-checkout`)
      .set(other.auth)
      .send({ amount: 1000 })
      .expect(403);
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: 999,
              external_reference: reference,
              status: 'approved',
              collector_id: 3858452334,
              transaction_amount: 1000,
              currency_id: 'ARS',
            }),
            { status: 200 },
          ),
      ),
    );
    const ts = String(Date.now());
    const sig = createHmac('sha256', 'e2e-webhook-secret')
      .update(`id:999;request-id:donation-test;ts:${ts};`)
      .digest('hex');
    await request(app.getHttpServer())
      .post(`${API}/billing/mercado-pago/webhook`)
      .query({ 'data.id': '999' })
      .set('x-request-id', 'donation-test')
      .set('x-signature', `ts=${ts},v1=${sig}`)
      .send({ type: 'payment', data: { id: '999' } })
      .expect(200);
    await app.get(MercadoPagoWebhookService).processNext();
    const db = app.get(DataSource);
    expect(await db.getRepository(SubscriptionPayment).count()).toBe(0);
    const owner = await db
      .getRepository(User)
      .findOneOrFail({
        where: { id: session.user.id },
        select: { id: true, proUntil: true, mpProUntil: true },
      });
    expect(owner.proUntil).toBeNull();
    expect(owner.mpProUntil).toBeNull();
  }, 60000);
});
