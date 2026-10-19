import { config } from 'dotenv';

/**
 * Carga las variables de entorno desde el archivo `.env`.
 *
 * En desarrollo el archivo `.env` tiene prioridad (override) para que variables
 * sueltas del shell —por ejemplo un `DB_PORT` heredado de otra sesión— no pisen
 * la configuración del proyecto. En producción se respeta el entorno real del
 * contenedor o servidor.
 *
 * Debe importarse como efecto secundario ANTES que cualquier módulo que lea
 * `process.env` (por ejemplo `./env.js`).
 */
const isProduction = process.env['NODE_ENV'] === 'production';

config({ override: !isProduction, quiet: true });
