/**
 * Variables de entorno de las pruebas e2e.
 *
 * Se ejecuta ANTES de importar `AppModule` (Vitest resuelve `setupFiles` antes
 * de evaluar el archivo de test), así que `src/core/config/env.ts` lee estos
 * valores. A propósito no se carga `.env`: en local y en CI manda el entorno,
 * y las pruebas usan una base de datos separada (`devcrm_test`).
 */
process.env.NODE_ENV = 'test';
process.env.DB_HOST = process.env.E2E_DB_HOST ?? process.env.DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.E2E_DB_PORT ?? process.env.DB_PORT ?? '5432';
process.env.DB_USER = process.env.E2E_DB_USER ?? process.env.DB_USER ?? 'devcrm_user';
process.env.DB_PASSWORD =
  process.env.E2E_DB_PASSWORD ?? process.env.DB_PASSWORD ?? 'devcrm_password';
process.env.DB_NAME = process.env.E2E_DB_NAME ?? 'devcrm_test';
process.env.DB_SSL = process.env.E2E_DB_SSL ?? 'false';
process.env.DB_MIGRATIONS_RUN = 'true';
process.env.TEST_SEED_ENABLED = 'true';
process.env.BILLING_CHECKOUT_URL = '';
process.env.BILLING_CHECKOUT_PRICE = '';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'e2e_secret_change_me';
