import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Repository } from 'typeorm';
import { GoogleAuthService } from './google-auth.service.js';
import type { User } from '../users/entities/user.entity.js';
const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  clientId: 'google-client',
  payload: {
    sub: 'google-1',
    email: 'owner@gmail.com',
    email_verified: true,
    nonce: 'expected-nonce',
    name: 'Google User',
    hd: undefined as string | undefined,
  },
}));
vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = mocks.verify;
  },
}));
vi.mock('../../core/config/env.js', () => ({
  env: {
    get googleClientId() {
      return mocks.clientId;
    },
  },
}));
const users = {
  findOne: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};
const dto = { credential: 'signed-token', nonce: 'expected-nonce' };
let service: GoogleAuthService;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.clientId = 'google-client';
  mocks.payload = {
    sub: 'google-1',
    email: 'owner@gmail.com',
    email_verified: true,
    nonce: 'expected-nonce',
    name: 'Google User',
    hd: undefined,
  };
  mocks.verify.mockResolvedValue({ getPayload: () => mocks.payload });
  users.findOne.mockResolvedValue(null);
  users.update.mockResolvedValue({ affected: 1 });
  users.create.mockImplementation((value) => value);
  users.save.mockImplementation(async (value) => ({ ...value, id: 'new-id' }));
  service = new GoogleAuthService(users as unknown as Repository<User>);
});
describe('GoogleAuthService', () => {
  it('rechaza firma, audiencia o vigencia inválidas antes de consultar usuarios', async () => {
    mocks.verify.mockRejectedValue(new Error('invalid token'));
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 401,
    });
    expect(users.findOne).not.toHaveBeenCalled();
  });
  it('valida con el Client ID del servidor', async () => {
    await service.authenticate(dto);
    expect(mocks.verify).toHaveBeenCalledWith({
      idToken: dto.credential,
      audience: 'google-client',
    });
  });
  it('rechaza correo no verificado', async () => {
    mocks.payload.email_verified = false;
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 401,
    });
    expect(users.save).not.toHaveBeenCalled();
  });
  it('rechaza nonce diferente', async () => {
    await expect(
      service.authenticate({ ...dto, nonce: 'wrong' }),
    ).rejects.toMatchObject({ status: 401 });
    expect(users.findOne).not.toHaveBeenCalled();
  });
  it('identifica una cuenta vinculada por sub aunque cambie su correo', async () => {
    users.findOne.mockResolvedValue({
      id: 'existing',
      email: 'original@gmail.com',
    });
    expect(await service.authenticate(dto)).toMatchObject({ id: 'existing' });
    expect(users.findOne).toHaveBeenCalledWith({
      where: { googleSub: 'google-1' },
    });
    expect(users.save).not.toHaveBeenCalled();
  });
  it('crea cuenta con contraseña aleatoria hasheada y sin guardar el token', async () => {
    const user = await service.authenticate(dto);
    expect(user).toMatchObject({
      id: 'new-id',
      googleSub: 'google-1',
      email: 'owner@gmail.com',
    });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
    expect(user).not.toHaveProperty('credential');
  });
  it('conserva la cuenta Gmail existente al asociar Google', async () => {
    users.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'old',
        email: 'owner@gmail.com',
        name: 'Nombre actual',
        googleSub: null,
      });
    expect(await service.authenticate(dto)).toMatchObject({
      id: 'old',
      name: 'Nombre actual',
    });
    expect(users.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'old' }),
      { googleSub: 'google-1' },
    );
    expect(users.save).not.toHaveBeenCalled();
  });
  it('no asocia por correo de terceros aunque Google lo haya verificado', async () => {
    mocks.payload.email = 'owner@example.com';
    users.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'old', googleSub: null });
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 409,
    });
    expect(users.update).not.toHaveBeenCalled();
  });
  it('no reemplaza una identidad Google diferente', async () => {
    users.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'old', googleSub: 'another-google' });
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 409,
    });
    expect(users.update).not.toHaveBeenCalled();
  });
  it('maneja creación simultánea sin producir error interno', async () => {
    users.save.mockRejectedValue({ code: '23505' });
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 409,
    });
  });
  it('permanece deshabilitado sin Client ID', async () => {
    mocks.clientId = '';
    await expect(service.authenticate(dto)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});
