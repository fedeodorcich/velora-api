import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  API,
  createE2eApp,
  registerUser,
  resetDatabase,
  type TestSession,
} from './support/e2e-app.js';

describe('Aislamiento multi-usuario (e2e)', () => {
  let app: INestApplication;
  let owner: TestSession;
  let intruder: TestSession;
  let clientId: string;
  let quoteId: string;
  let projectId: string;
  let paymentId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);

    owner = await registerUser(app, { email: 'duenio@velora.test', name: 'Dueña' });
    intruder = await registerUser(app, { email: 'intruso@velora.test', name: 'Intruso' });

    const client = await request(app.getHttpServer())
      .post(`${API}/clients`)
      .set(owner.auth)
      .send({ name: 'Cliente Privado', email: 'privado@velora.test' })
      .expect(201);
    clientId = client.body.id;

    const quote = await request(app.getHttpServer())
      .post(`${API}/quotes`)
      .set(owner.auth)
      .send({
        clientId,
        title: 'Proyecto privado',
        status: 'aceptado',
        items: [{ description: 'Trabajo', quantity: 1, unitPrice: 100 }],
      })
      .expect(201);
    quoteId = quote.body.id;

    const project = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set(owner.auth)
      .send({ quoteId })
      .expect(201);
    projectId = project.body.id;

    const payment = await request(app.getHttpServer())
      .post(`${API}/payments`)
      .set(owner.auth)
      .send({
        projectId,
        concept: 'Cuota privada',
        amount: 50,
        dueDate: '2030-01-01',
      })
      .expect(201);
    paymentId = payment.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('cada usuario solo lista sus propios recursos', async () => {
    for (const resource of ['clients', 'quotes', 'projects', 'payments']) {
      const ownList = await request(app.getHttpServer())
        .get(`${API}/${resource}`)
        .set(owner.auth)
        .expect(200);
      expect(ownList.body).toHaveLength(1);

      const foreignList = await request(app.getHttpServer())
        .get(`${API}/${resource}`)
        .set(intruder.auth)
        .expect(200);
      expect(foreignList.body).toEqual([]);
    }
  });

  it('no permite leer recursos ajenos', async () => {
    const resources: Array<[string, string]> = [
      ['clients', clientId],
      ['quotes', quoteId],
      ['projects', projectId],
      ['payments', paymentId],
    ];

    for (const [resource, id] of resources) {
      await request(app.getHttpServer())
        .get(`${API}/${resource}/${id}`)
        .set(intruder.auth)
        .expect(404);
    }
  });

  it('no permite modificar ni borrar recursos ajenos', async () => {
    await request(app.getHttpServer())
      .patch(`${API}/clients/${clientId}`)
      .set(intruder.auth)
      .send({ name: 'Hackeado' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`${API}/quotes/${quoteId}/status`)
      .set(intruder.auth)
      .send({ status: 'rechazado' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`${API}/projects/${projectId}/status`)
      .set(intruder.auth)
      .send({ status: 'finalizado' })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`${API}/payments/${paymentId}/status`)
      .set(intruder.auth)
      .send({ status: 'pagado' })
      .expect(404);

    for (const [resource, id] of [
      ['clients', clientId],
      ['quotes', quoteId],
      ['projects', projectId],
      ['payments', paymentId],
    ] as Array<[string, string]>) {
      await request(app.getHttpServer())
        .delete(`${API}/${resource}/${id}`)
        .set(intruder.auth)
        .expect(404);
    }
  });

  it('no permite crear recursos colgando de datos ajenos', async () => {
    await request(app.getHttpServer())
      .post(`${API}/quotes`)
      .set(intruder.auth)
      .send({
        clientId,
        title: 'Presupuesto ajeno',
        items: [{ description: 'Intento', quantity: 1, unitPrice: 10 }],
      })
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set(intruder.auth)
      .send({ quoteId })
      .expect(404);

    await request(app.getHttpServer())
      .post(`${API}/payments`)
      .set(intruder.auth)
      .send({
        projectId,
        concept: 'Cobro ajeno',
        amount: 10,
        dueDate: '2030-01-01',
      })
      .expect(404);
  });

  it('el dashboard ajeno queda en cero', async () => {
    const summary = await request(app.getHttpServer())
      .get(`${API}/dashboard/summary`)
      .set(intruder.auth)
      .expect(200);

    expect(summary.body).toEqual({
      metrics: { activeProjectsCount: 0, pendingQuotesCount: 0, totalClientsCount: 0 },
      financials: [],
      upcomingPayments: [],
      recentProjects: [],
    });
  });

  it('rechaza identificadores con formato inválido', async () => {
    await request(app.getHttpServer())
      .get(`${API}/clients/no-es-un-uuid`)
      .set(owner.auth)
      .expect(400);
  });
});
