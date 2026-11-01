import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createE2eApp } from './support/e2e-app.js';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('expone el health check bajo el prefijo /api', async () => {
    const response = await request(app.getHttpServer()).get(`${API}/health`).expect(200);

    expect(response.body.status).toBe('ok');
    expect(typeof response.body.uptime).toBe('number');
  });

  it('no responde fuera del prefijo /api', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('devuelve 404 en rutas desconocidas', async () => {
    await request(app.getHttpServer()).get(`${API}/no-existe`).expect(404);
  });
});
