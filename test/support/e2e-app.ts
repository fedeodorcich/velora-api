import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/core/bootstrap/configure-app.js';

/** Prefijo global de la API, el mismo que usa `main.ts`. */
export const API = '/api';

export interface TestUser {
  id: string;
  email: string;
  name: string;
}

export interface TestSession {
  email: string;
  password: string;
  token: string;
  user: TestUser;
  /** Cabecera lista para usar en `request(...).set(auth)` */
  auth: { Authorization: string };
}

export interface RegisterOptions {
  email?: string;
  password?: string;
  name?: string;
}

/**
 * Levanta la aplicación completa (migraciones incluidas) con la misma
 * configuración global que `main.ts`. Cada archivo e2e usa una instancia y la
 * cierra en `afterAll`.
 */
export async function createE2eApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

/**
 * Vacía todas las tablas del dominio. Se llama en `beforeAll` de cada archivo;
 * como `fileParallelism` está desactivado, nunca se pisan entre sí.
 */
export async function resetDatabase(app: INestApplication): Promise<void> {
  await app
    .get(DataSource)
    .query(
      'TRUNCATE TABLE payments, projects, quote_items, quotes, clients, users RESTART IDENTITY CASCADE',
    );
}

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${randomUUID()}@velora.test`;
}

/** Registra un usuario nuevo y devuelve su sesión (token + cabecera). */
export async function registerUser(
  app: INestApplication,
  options: RegisterOptions = {},
): Promise<TestSession> {
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? 'Secreto123!';
  const name = options.name ?? 'Usuario E2E';

  const response = await request(app.getHttpServer())
    .post(`${API}/auth/register`)
    .send({ name, email, password })
    .expect(201);

  return buildSession(response.body, email, password);
}

/** Inicia sesión con credenciales existentes. */
export async function loginUser(
  app: INestApplication,
  email: string,
  password: string,
): Promise<TestSession> {
  const response = await request(app.getHttpServer())
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);

  return buildSession(response.body, email, password);
}

/** Ejecuta `POST /api/dev/seed` y devuelve el cuerpo de la respuesta. */
export async function seedDemo(app: INestApplication): Promise<{
  user: { email: string; password: string };
  counts: { clients: number; quotes: number; projects: number; payments: number };
  dashboard: { metrics: { activeProjectsCount: number } };
}> {
  const response = await request(app.getHttpServer()).post(`${API}/dev/seed`).expect(200);
  return response.body;
}

function buildSession(
  body: { accessToken: string; user: TestUser },
  email: string,
  password: string,
): TestSession {
  return {
    email,
    password,
    token: body.accessToken,
    user: body.user,
    auth: { Authorization: `Bearer ${body.accessToken}` },
  };
}
