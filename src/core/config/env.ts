/**
 * Lectura centralizada y tipada de las variables de entorno.
 * Evita dependencias externas: solo `process.env` (cargado vía dotenv en el entrypoint).
 */

function readString(name: string, fallback: string): string {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim();
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`La variable de entorno ${name} debe ser numérica.`);
  }
  return parsed;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  return raw.trim().toLowerCase() === 'true';
}

const nodeEnv = readString('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';

/**
 * Orígenes permitidos por CORS: `CORS_ORIGIN` admite una lista separada por comas
 * (`https://velora.app,https://www.velora.app`).
 */
const corsOrigins = readString('CORS_ORIGIN', 'http://localhost:4200')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

const jwtSecretFallback = 'devcrm_dev_secret_change_me';
const jwtSecret = readString('JWT_SECRET', jwtSecretFallback);

if (isProduction && jwtSecret === jwtSecretFallback) {
  throw new Error('JWT_SECRET debe configurarse explícitamente en producción.');
}

export const env = {
  nodeEnv,
  isProduction,
  port: readNumber('PORT', 3000),
  corsOrigins,
  database: {
    host: readString('DB_HOST', 'localhost'),
    port: readNumber('DB_PORT', 5432),
    username: readString('DB_USER', 'devcrm_user'),
    password: readString('DB_PASSWORD', 'devcrm_password'),
    name: readString('DB_NAME', 'devcrm_db'),
    /** Solo para prototipado rápido: en producción siempre queda desactivado. */
    synchronize: readBoolean('DB_SYNCHRONIZE', false) && !isProduction,
    /** Aplica automáticamente las migraciones pendientes al arrancar la API. */
    migrationsRun: readBoolean('DB_MIGRATIONS_RUN', true),
    /** Los Postgres gestionados (Neon, Render) exigen TLS. */
    ssl: readBoolean('DB_SSL', false),
  },
  jwt: {
    secret: jwtSecret,
    /** Duración del token expresada en segundos (por defecto 7 días). */
    expiresIn: readNumber('JWT_EXPIRES_IN', 60 * 60 * 24 * 7),
  },
  testing: {
    /** Endpoint de seed de datos demo: solo disponible fuera de producción con la flag activa. */
    seedEnabled: readBoolean('TEST_SEED_ENABLED', false) && !isProduction,
  },
} as const;
