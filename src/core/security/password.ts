import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const PREFIX = 'scrypt';

/**
 * Hashea una contraseña en claro con scrypt (sin dependencias externas).
 * Formato resultante: `scrypt$<salt>$<hash>`.
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const derivedKey = await scryptAsync(plainPassword, salt, KEY_LENGTH);
  return `${PREFIX}$${salt}$${derivedKey.toString('hex')}`;
}

/**
 * Compara de forma segura una contraseña en claro contra su hash almacenado.
 */
export async function verifyPassword(plainPassword: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, hash] = storedHash.split('$');
  if (algorithm !== PREFIX || !salt || !hash) {
    return false;
  }

  const derivedKey = await scryptAsync(plainPassword, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
