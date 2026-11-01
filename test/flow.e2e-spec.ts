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

/** Fecha ISO corta desplazada respecto de hoy. */
function isoDateFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('Flujo completo (e2e)', () => {
  let app: INestApplication;
  let session: TestSession;
  let clientId: string;
  let quoteId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
    session = await registerUser(app, { email: 'flujo@velora.test', name: 'Flujo E2E' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('crea un cliente', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/clients`)
      .set(session.auth)
      .send({
        name: 'Marina Ruiz',
        email: 'Marina@Acme.TEST',
        company: 'Acme Studio',
        currency: 'usd',
      })
      .expect(201);

    clientId = response.body.id;
    expect(response.body.email).toBe('marina@acme.test');
    expect(response.body.currency).toBe('USD');
    expect(response.body.status).toBe('lead');
  });

  it('crea un presupuesto con líneas y calcula los totales', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/quotes`)
      .set(session.auth)
      .send({
        clientId,
        title: 'Rediseño de tienda',
        taxRate: 21,
        items: [
          { description: 'Diseño UX/UI', quantity: 2, unitPrice: 100 },
          { description: 'Implementación', quantity: 1, unitPrice: 50 },
        ],
      })
      .expect(201);

    quoteId = response.body.id;
    expect(response.body.number).toBe(1);
    expect(response.body.status).toBe('borrador');
    expect(response.body.currency).toBe('USD');
    expect(Number(response.body.subtotal)).toBe(250);
    expect(Number(response.body.taxAmount)).toBe(52.5);
    expect(Number(response.body.total)).toBe(302.5);
    expect(response.body.items).toHaveLength(2);
    expect(response.body.items[0]).toMatchObject({
      description: 'Diseño UX/UI',
      position: 0,
    });
    expect(Number(response.body.items[0].quantity)).toBe(2);
    expect(Number(response.body.items[0].unitPrice)).toBe(100);
  });

  it('no permite crear un proyecto desde un presupuesto no aceptado', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set(session.auth)
      .send({ quoteId })
      .expect(409);

    expect(response.body.reason).toBe('quote-not-approved');
  });

  it('acepta el presupuesto y crea el proyecto derivado', async () => {
    await request(app.getHttpServer())
      .patch(`${API}/quotes/${quoteId}/status`)
      .set(session.auth)
      .send({ status: 'aceptado' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set(session.auth)
      .send({
        quoteId,
        progress: 10,
        startDate: isoDateFromNow(-2),
        dueDate: isoDateFromNow(20),
        description: 'Tienda con checkout simplificado.',
      })
      .expect(201);

    projectId = response.body.id;
    expect(response.body).toMatchObject({
      clientId,
      quoteId,
      name: 'Rediseño de tienda',
      status: 'planificado',
      currency: 'USD',
      progress: 10,
    });
    expect(Number(response.body.budget)).toBe(302.5);
  });

  it('no permite reutilizar el presupuesto ni cambiar su estado', async () => {
    const duplicate = await request(app.getHttpServer())
      .post(`${API}/projects`)
      .set(session.auth)
      .send({ quoteId })
      .expect(409);
    expect(duplicate.body.reason).toBe('quote-taken');

    const locked = await request(app.getHttpServer())
      .patch(`${API}/quotes/${quoteId}/status`)
      .set(session.auth)
      .send({ status: 'rechazado' })
      .expect(409);
    expect(locked.body.reason).toBe('project');
  });

  it('registra cobros y refleja todo en el dashboard', async () => {
    await request(app.getHttpServer())
      .patch(`${API}/projects/${projectId}/status`)
      .set(session.auth)
      .send({ status: 'en_progreso' })
      .expect(200);

    const paid = await request(app.getHttpServer())
      .post(`${API}/payments`)
      .set(session.auth)
      .send({
        projectId,
        concept: 'Anticipo',
        amount: 100,
        dueDate: isoDateFromNow(-1),
        method: 'Transferencia',
      })
      .expect(201);

    expect(paid.body.currency).toBe('USD');
    expect(paid.body.status).toBe('pendiente');

    const paidStatus = await request(app.getHttpServer())
      .patch(`${API}/payments/${paid.body.id}/status`)
      .set(session.auth)
      .send({ status: 'pagado' })
      .expect(200);
    expect(paidStatus.body.paidAt).toBeTruthy();

    const overdue = await request(app.getHttpServer())
      .post(`${API}/payments`)
      .set(session.auth)
      .send({
        projectId,
        concept: 'Cuota vencida',
        amount: 50,
        dueDate: isoDateFromNow(-5),
      })
      .expect(201);
    expect(overdue.body.status).toBe('pendiente');

    const summary = await request(app.getHttpServer())
      .get(`${API}/dashboard/summary`)
      .set(session.auth)
      .expect(200);

    expect(summary.body.metrics).toEqual({
      activeProjectsCount: 1,
      pendingQuotesCount: 0,
      totalClientsCount: 1,
    });
    expect(summary.body.financials).toEqual([
      {
        currency: 'USD',
        collectedThisMonth: 100,
        pendingTotal: 50,
        overdueTotal: 50,
        overdueCount: 1,
      },
    ]);
    expect(summary.body.upcomingPayments).toHaveLength(1);
    expect(summary.body.upcomingPayments[0]).toMatchObject({
      concept: 'Cuota vencida',
      currency: 'USD',
      isOverdue: true,
      projectName: 'Rediseño de tienda',
      clientName: 'Marina Ruiz',
    });
    expect(summary.body.recentProjects).toHaveLength(1);
    expect(summary.body.recentProjects[0]).toMatchObject({
      code: 'PRY-0001',
      collectedAmount: 100,
      budget: 302.5,
    });
  });

  it('protege los borrados con dependencias', async () => {
    const projectBlocked = await request(app.getHttpServer())
      .delete(`${API}/projects/${projectId}`)
      .set(session.auth)
      .expect(409);
    expect(projectBlocked.body.reason).toBe('payments');

    const clientBlocked = await request(app.getHttpServer())
      .delete(`${API}/clients/${clientId}`)
      .set(session.auth)
      .expect(409);
    expect(clientBlocked.body.reason).toBe('projects');
  });

  it('borra proyectos y clientes en cascada cuando se confirma', async () => {
    await request(app.getHttpServer())
      .delete(`${API}/projects/${projectId}?cascade=true`)
      .set(session.auth)
      .expect(204);

    const payments = await request(app.getHttpServer())
      .get(`${API}/payments`)
      .set(session.auth)
      .expect(200);
    expect(payments.body).toEqual([]);

    await request(app.getHttpServer())
      .delete(`${API}/clients/${clientId}?cascade=true`)
      .set(session.auth)
      .expect(204);

    const quotes = await request(app.getHttpServer())
      .get(`${API}/quotes`)
      .set(session.auth)
      .expect(200);
    expect(quotes.body).toEqual([]);

    const summary = await request(app.getHttpServer())
      .get(`${API}/dashboard/summary`)
      .set(session.auth)
      .expect(200);
    expect(summary.body.metrics).toEqual({
      activeProjectsCount: 0,
      pendingQuotesCount: 0,
      totalClientsCount: 0,
    });
    expect(summary.body.financials).toEqual([]);
  });
});
