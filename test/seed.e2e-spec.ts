import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../src/modules/dev/seed.service.js';
import {
  API,
  createE2eApp,
  loginUser,
  registerUser,
  resetDatabase,
  seedDemo,
} from './support/e2e-app.js';

describe('Seed de desarrollo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea el set demo completo y es idempotente', async () => {
    const first = await seedDemo(app);
    const second = await seedDemo(app);

    expect(first.user).toEqual({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    expect(second.counts).toEqual({ clients: 3, quotes: 7, projects: 4, payments: 7 });
    expect(second.counts).toEqual(first.counts);
    expect(second.dashboard.metrics.activeProjectsCount).toBe(2);
  });

  it('permite iniciar sesión con el usuario demo y ver el dashboard', async () => {
    const session = await loginUser(app, DEMO_EMAIL, DEMO_PASSWORD);

    const summary = await request(app.getHttpServer())
      .get(`${API}/dashboard/summary`)
      .set(session.auth)
      .expect(200);

    expect(summary.body.metrics).toEqual({
      activeProjectsCount: 2,
      pendingQuotesCount: 1,
      totalClientsCount: 3,
    });

    const currencies = (summary.body.financials as { currency: string }[]).map(
      (financial) => financial.currency,
    );
    expect(currencies).toEqual(['EUR', 'USD']);
    expect(summary.body.upcomingPayments).toHaveLength(4);
    expect(summary.body.recentProjects).toHaveLength(2);
  });

  it('no toca los datos de otros usuarios', async () => {
    const other = await registerUser(app, { email: 'real@velora.test' });
    const client = await request(app.getHttpServer())
      .post(`${API}/clients`)
      .set(other.auth)
      .send({ name: 'Cliente Real', email: 'cliente@real.test' })
      .expect(201);

    await seedDemo(app);

    const response = await request(app.getHttpServer())
      .get(`${API}/clients/${client.body.id}`)
      .set(other.auth)
      .expect(200);

    expect(response.body.name).toBe('Cliente Real');
  });

  it('elimina el demo y permite volver a sembrarlo', async () => {
    const session = await loginUser(app, DEMO_EMAIL, DEMO_PASSWORD);

    const removed = await request(app.getHttpServer())
      .delete(`${API}/dev/seed`)
      .expect(200);
    expect(removed.body).toEqual({ removed: true });

    // Al borrar el usuario demo su token deja de ser válido.
    await request(app.getHttpServer())
      .get(`${API}/dashboard/summary`)
      .set(session.auth)
      .expect(401);

    const removedAgain = await request(app.getHttpServer())
      .delete(`${API}/dev/seed`)
      .expect(200);
    expect(removedAgain.body).toEqual({ removed: false });

    const reseeded = await seedDemo(app);
    expect(reseeded.counts).toEqual({ clients: 3, quotes: 7, projects: 4, payments: 7 });
  });
});
