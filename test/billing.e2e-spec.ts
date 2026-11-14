import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { User } from '../src/modules/users/entities/user.entity.js';
import { API, createE2eApp, registerUser, resetDatabase } from './support/e2e-app.js';

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+6kAAAAASUVORK5CYII=';
const client = { name: 'Cliente de prueba', email: 'cliente@velora.test' };

describe('Piloto Pro', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('registra el interés en la cuenta y mantiene el checkout deshabilitado por defecto', async () => {
    const session = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();
    await request(server).get(`${API}/billing`).expect(401);
    await request(server).post(`${API}/billing/interest`).set(session.auth).expect(204);
    const registered = await request(server).get(`${API}/billing`).set(session.auth).expect(200);
    expect(registered.body).toMatchObject({
      plan: 'free',
      activeClientLimit: 5,
      interestRegistered: true,
      checkout: null,
    });
    const unrelated = await request(server).get(`${API}/billing`).set(other.auth).expect(200);
    expect(unrelated.body.interestRegistered).toBe(false);
  });

  it('protege el cupo incluso al activar clientes en paralelo', async () => {
    const { auth } = await registerUser(app);
    const server = app.getHttpServer();
    const add = () => request(server).post(`${API}/clients`).set(auth).send({ ...client, status: 'activo' });
    const responses = await Promise.all(Array.from({ length: 6 }, add));
    expect(responses.map((res) => res.status).sort()).toEqual([201, 201, 201, 201, 201, 403]);
    expect(responses.find((res) => res.status === 403)?.body.reason).toBe('active_client_limit');

    const lead = await request(server).post(`${API}/clients`).set(auth).send(client).expect(201);
    await request(server).patch(`${API}/clients/${lead.body.id}`).set(auth).send({ status: 'activo' }).expect(403);
    const active = responses.find((res) => res.status === 201)?.body.id;
    await request(server).patch(`${API}/clients/${active}`).set(auth).send({ status: 'inactivo' }).expect(200);
    await request(server).patch(`${API}/clients/${lead.body.id}`).set(auth).send({ status: 'activo' }).expect(200);
  });

  it('habilita el logo y levanta el límite mientras Pro está vigente, usando la misma sesión', async () => {
    const session = await registerUser(app);
    const other = await registerUser(app);
    const server = app.getHttpServer();
    const users = app.get(DataSource).getRepository(User);
    const add = () => request(server).post(`${API}/clients`).set(session.auth).send({ ...client, status: 'activo' });
    const upload = (dataUrl: string) =>
      request(server).put(`${API}/billing/quote-logo`).set(session.auth).send({ dataUrl });
    const getPlan = () => request(server).get(`${API}/billing`).set(session.auth);

    await upload(LOGO).expect(403);
    await users.update({ id: session.user.id }, { proUntil: new Date(Date.now() + 60_000) });
    const responses = await Promise.all(Array.from({ length: 6 }, add));
    expect(responses.every((res) => res.status === 201)).toBe(true);
    await upload('data:image/png;base64,AAAA').expect(400);
    await upload(LOGO).expect(204);
    expect((await getPlan().expect(200)).body).toMatchObject({ plan: 'pro', quoteLogo: LOGO, activeClientLimit: null });
    expect((await request(server).get(`${API}/billing`).set(other.auth).expect(200)).body.quoteLogo).toBeNull();

    await users.update({ id: session.user.id }, { proUntil: new Date(0) });
    expect((await getPlan().expect(200)).body).toMatchObject({ plan: 'free', quoteLogo: null, activeClientLimit: 5 });
    await add().expect(403);
    await request(server).patch(`${API}/clients/${responses[0].body.id}`).set(session.auth)
      .send({ name: 'Cliente actualizado', status: 'activo' }).expect(200);
    const list = await request(server).get(`${API}/clients`).set(session.auth).expect(200);
    expect(list.body).toHaveLength(6);
  });
});
