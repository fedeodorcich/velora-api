import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('genera un hash con formato scrypt verificable', async () => {
    const hash = await hashPassword('secreto123');

    expect(hash.startsWith('scrypt$')).toBe(true);
    await expect(verifyPassword('secreto123', hash)).resolves.toBe(true);
  });

  it('genera hashes distintos para la misma contraseña (salt aleatorio)', async () => {
    const first = await hashPassword('secreto123');
    const second = await hashPassword('secreto123');

    expect(first).not.toBe(second);
  });

  it('rechaza una contraseña incorrecta', async () => {
    const hash = await hashPassword('secreto123');

    await expect(verifyPassword('otra-contraseña', hash)).resolves.toBe(false);
  });

  it('rechaza un hash con formato inválido', async () => {
    await expect(verifyPassword('secreto123', 'formato-invalido')).resolves.toBe(false);
  });
});
