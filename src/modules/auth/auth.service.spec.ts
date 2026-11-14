import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../../core/security/password.js';
import { User } from '../users/entities/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'ana@devcrm.test',
    name: 'Ana',
    passwordHash: '',
    proUntil: null,
    quoteLogo: null,
    proRequestedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  const usersServiceMock = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updatePassword: vi.fn(),
  };
  const jwtServiceMock = { sign: vi.fn().mockReturnValue('token-firmado') };

  beforeEach(async () => {
    vi.clearAllMocks();
    jwtServiceMock.sign.mockReturnValue('token-firmado');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('registra un usuario nuevo y devuelve token + datos públicos (sin hash)', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(null);
    usersServiceMock.create.mockImplementation((data: Partial<User>) =>
      Promise.resolve(buildUser({ ...data, id: 'user-1' })),
    );

    const result = await service.register({
      name: 'Ana',
      email: 'ana@devcrm.test',
      password: 'secreto123',
    });

    expect(result.accessToken).toBe('token-firmado');
    expect(result.user).toEqual({ id: 'user-1', email: 'ana@devcrm.test', name: 'Ana' });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(usersServiceMock.create).toHaveBeenCalledOnce();
  });

  it('rechaza el registro si el correo ya existe', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(buildUser());

    await expect(
      service.register({ name: 'Ana', email: 'ana@devcrm.test', password: 'secreto123' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza el login con credenciales inválidas', async () => {
    usersServiceMock.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nadie@devcrm.test', password: 'secreto123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza el login cuando la contraseña no coincide', async () => {
    const passwordHash = await hashPassword('secreto123');
    usersServiceMock.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      service.login({ email: 'ana@devcrm.test', password: 'incorrecta1' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('inicia sesión con credenciales válidas', async () => {
    const passwordHash = await hashPassword('secreto123');
    usersServiceMock.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

    const result = await service.login({ email: 'ana@devcrm.test', password: 'secreto123' });

    expect(result.accessToken).toBe('token-firmado');
    expect(result.user.email).toBe('ana@devcrm.test');
  });

  it('actualiza el nombre del perfil y devuelve los datos públicos', async () => {
    usersServiceMock.update.mockResolvedValue(buildUser({ name: 'Ana María' }));

    const result = await service.updateProfile('user-1', { name: 'Ana María' });

    expect(usersServiceMock.update).toHaveBeenCalledWith('user-1', { name: 'Ana María' });
    expect(result).toEqual({ id: 'user-1', email: 'ana@devcrm.test', name: 'Ana María' });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('rechaza el cambio de contraseña si la actual no coincide', async () => {
    const passwordHash = await hashPassword('secreto123');
    usersServiceMock.findById.mockResolvedValue(buildUser({ passwordHash }));

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'incorrecta1',
        newPassword: 'nuevaClave123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(usersServiceMock.updatePassword).not.toHaveBeenCalled();
  });

  it('rechaza el cambio de contraseña si la sesión no corresponde a un usuario', async () => {
    usersServiceMock.findById.mockResolvedValue(null);

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'secreto123',
        newPassword: 'nuevaClave123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('cambia la contraseña cuando la actual es correcta', async () => {
    const passwordHash = await hashPassword('secreto123');
    usersServiceMock.findById.mockResolvedValue(buildUser({ passwordHash }));
    usersServiceMock.updatePassword.mockResolvedValue(undefined);

    await service.changePassword('user-1', {
      currentPassword: 'secreto123',
      newPassword: 'nuevaClave123',
    });

    expect(usersServiceMock.updatePassword).toHaveBeenCalledOnce();
    const [, storedHash] = usersServiceMock.updatePassword.mock.calls[0] as [string, string];
    expect(storedHash).not.toBe('nuevaClave123');
    expect(await verifyPassword('nuevaClave123', storedHash)).toBe(true);
  });
});
