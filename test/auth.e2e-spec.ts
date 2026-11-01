import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  API,
  createE2eApp,
  loginUser,
  registerUser,
  resetDatabase,
  uniqueEmail,
} from './support/e2e-app.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createE2eApp();
    await resetDatabase(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('registra un usuario y devuelve token y perfil', async () => {
    const email = uniqueEmail('auth-register');
    const session = await registerUser(app, { email, name: 'Ana Dev' });

    expect(session.token).toBeTruthy();
    expect(session.user).toMatchObject({ email, name: 'Ana Dev' });
  });

  it('rechaza un email ya registrado', async () => {
    const session = await registerUser(app, { email: uniqueEmail('auth-duplicado') });

    const response = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({ name: 'Otro Nombre', email: session.email, password: 'Secreto123!' })
      .expect(409);

    expect(response.body.message).toContain('Ya existe');
  });

  it('valida el cuerpo y rechaza campos desconocidos', async () => {
    const response = await request(app.getHttpServer())
      .post(`${API}/auth/register`)
      .send({
        name: 'X',
        email: 'no-es-un-email',
        password: '123',
        role: 'admin',
      })
      .expect(400);

    const messages = (response.body.message as string[]).join(' ');
    expect(messages).toContain('nombre');
    expect(messages).toContain('correo');
    expect(messages).toContain('contraseña');
    expect(messages).toContain('role');
  });

  it('inicia sesión con credenciales válidas y rechaza inválidas', async () => {
    const session = await registerUser(app, { email: uniqueEmail('auth-login') });

    const login = await loginUser(app, session.email, session.password);
    expect(login.user.id).toBe(session.user.id);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: session.email, password: 'ContraseñaIncorrecta' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: uniqueEmail('auth-inexistente'), password: session.password })
      .expect(401);
  });

  it('protege el perfil con JWT', async () => {
    const session = await registerUser(app, { email: uniqueEmail('auth-perfil') });

    await request(app.getHttpServer()).get(`${API}/auth/profile`).expect(401);

    const profile = await request(app.getHttpServer())
      .get(`${API}/auth/profile`)
      .set(session.auth)
      .expect(200);

    expect(profile.body).toEqual(session.user);
  });

  it('actualiza el nombre del perfil', async () => {
    const session = await registerUser(app, { email: uniqueEmail('auth-update') });

    const response = await request(app.getHttpServer())
      .patch(`${API}/auth/profile`)
      .set(session.auth)
      .send({ name: 'Nombre Nuevo' })
      .expect(200);

    expect(response.body).toMatchObject({ id: session.user.id, name: 'Nombre Nuevo' });
    expect(response.body).not.toHaveProperty('passwordHash');
  });

  it('cambia la contraseña y obliga a usar la nueva', async () => {
    const session = await registerUser(app, { email: uniqueEmail('auth-password') });

    await request(app.getHttpServer())
      .patch(`${API}/auth/profile/password`)
      .set(session.auth)
      .send({ currentPassword: 'OtraCosa123', newPassword: 'NuevaClave456' })
      .expect(401);

    await request(app.getHttpServer())
      .patch(`${API}/auth/profile/password`)
      .set(session.auth)
      .send({ currentPassword: session.password, newPassword: 'NuevaClave456' })
      .expect(204);

    await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: session.email, password: session.password })
      .expect(401);

    const login = await loginUser(app, session.email, 'NuevaClave456');
    expect(login.user.id).toBe(session.user.id);
  });
});
