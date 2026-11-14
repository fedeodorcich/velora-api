import dataSource from '../../core/database/data-source.js';
import { User } from '../users/entities/user.entity.js';

const [emailArg, until, ...extra] = process.argv.slice(2);
const expiry = until === 'revoke' ? null : new Date(until);
const email = emailArg?.toLowerCase().trim();
if (!email || !until || extra.length) {
  throw new Error('Uso: npm run billing:set-pro -- correo YYYY-MM-DDTHH:mm:ssZ | revoke');
}
if (expiry && (
  Number.isNaN(expiry.getTime()) ||
  expiry.toISOString().replace('.000Z', 'Z') !== until ||
  expiry.getTime() <= Date.now()
)) {
  throw new Error('Ingresá una fecha futura en formato UTC YYYY-MM-DDTHH:mm:ssZ.');
}
await dataSource.initialize();
try {
  const result = await dataSource.getRepository(User).update({ email }, { proUntil: expiry });
  if (result.affected !== 1) {
    throw new Error('No se encontró una cuenta con ese correo.');
  }
  console.log(expiry ? `Pro activo hasta ${expiry.toISOString()}.` : 'Pro revocado.');
} finally {
  await dataSource.destroy();
}
