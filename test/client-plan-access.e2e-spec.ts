import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/modules/users/entities/user.entity.js';
import { Client } from '../src/modules/clients/entities/client.entity.js';
import { API, createE2eApp, registerUser, resetDatabase } from './support/e2e-app.js';

describe('Vencimiento de Pro: primeros cinco clientes', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createE2eApp(); await resetDatabase(app); });
  afterAll(async () => { await app?.close(); });

  it('restringe altas, conserva operaciones existentes y vuelve a habilitar con Pro', async () => {
    const session = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();
    const users = app.get(DataSource).getRepository(User);
    const clients = app.get(DataSource).getRepository(Client);
    const url = (path: string) => `${API}/${path}`;
    await users.update({ id: session.user.id }, { proUntil: new Date(Date.now() + 3600_000) });
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await request(server).post(url('clients')).set(session.auth)
        .send({ name: `Cliente ${i}`, email: `cliente${i}@velora.test` }).expect(201);
      ids.push(res.body.id as string);
      await clients.update({ id: ids[i], userId: session.user.id }, { createdAt: new Date(2026, 0, i + 1) });
    }
    const quotePayload = (clientId: string) => ({ clientId, title: 'Trabajo contratado', status: 'aceptado', items: [{ description: 'Servicio', quantity: 1, unitPrice: 100 }] });
    const createQuote = (clientId: string) => request(server).post(url('quotes')).set(session.auth).send(quotePayload(clientId));
    const q = await createQuote(ids[5]).expect(201);
    const spare = await createQuote(ids[5]).expect(201);
    const project = await request(server).post(url('projects')).set(session.auth).send({ quoteId: q.body.id }).expect(201);
    const paymentPayload = { projectId: project.body.id, concept: 'Saldo pendiente', amount: 50, dueDate: '2027-01-01' };
    const payment = await request(server).post(url('payments')).set(session.auth).send(paymentPayload).expect(201);
    expect((await request(server).get(url('clients/creation-access')).set(session.auth).expect(200)).body.clientIds).toBeNull();
    await users.update({ id: session.user.id }, { proUntil: new Date(0) });
    const access = await request(server).get(url('clients/creation-access')).set(session.auth).expect(200);
    expect(access.body.clientIds).toEqual(ids.slice(0, 5));
    expect((await createQuote(ids[5]).expect(403)).body.reason).toBe('client_creation_limit');
    await request(server).post(url('projects')).set(session.auth).send({ quoteId: spare.body.id }).expect(403);
    await request(server).post(url('payments')).set(session.auth).send(paymentPayload).expect(403);
    const first = await createQuote(ids[0]).expect(201);
    const firstProject = await request(server).post(url('projects')).set(session.auth).send({ quoteId: first.body.id }).expect(201);
    await request(server).post(url('payments')).set(session.auth).send({ ...paymentPayload, projectId: firstProject.body.id }).expect(201);
    await request(server).patch(url(`quotes/${q.body.id}`)).set(session.auth).send({ title: 'Presupuesto actualizado', clientId: ids[5] }).expect(200);
    await request(server).patch(url(`quotes/${first.body.id}`)).set(session.auth).send({ clientId: ids[5] }).expect(403);
    await request(server).patch(url(`projects/${project.body.id}`)).set(session.auth).send({ notes: 'Conservado' }).expect(200);
    await request(server).patch(url(`payments/${payment.body.id}`)).set(session.auth).send({ notes: 'Actualizado' }).expect(200);
    await request(server).patch(url(`payments/${payment.body.id}/status`)).set(session.auth).send({ status: 'pagado' }).expect(200);
    for (const [kind, id] of [['quotes', q.body.id], ['projects', project.body.id], ['payments', payment.body.id]]) {
      await request(server).get(url(`${kind}/${id}`)).set(session.auth).expect(200);
      await request(server).get(url(`${kind}/${id}`)).set(other.auth).expect(404);
    }
    const otherAccess = await request(server).get(url('clients/creation-access')).set(other.auth).expect(200);
    expect(otherAccess.body.clientIds).toEqual([]);
    await request(server).get(url('clients/creation-access')).expect(401);
    await request(server).patch(url(`clients/${ids[0]}`)).set(session.auth).send({ status: 'inactivo', name: 'Renombrado' }).expect(200);
    expect((await request(server).get(url('clients/creation-access')).set(session.auth).expect(200)).body.clientIds).toEqual(ids.slice(0, 5));
    await users.update({ id: session.user.id }, { mpProUntil: new Date(Date.now() + 3600_000) });
    await createQuote(ids[5]).expect(201);
    await request(server).post(url('projects')).set(session.auth).send({ quoteId: spare.body.id }).expect(201);
    await request(server).post(url('payments')).set(session.auth).send(paymentPayload).expect(201);
  }, 180_000);
});
