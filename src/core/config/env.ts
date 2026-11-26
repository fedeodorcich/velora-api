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

const checkoutUrl = readString('BILLING_CHECKOUT_URL', '');
const checkoutPrice = readString('BILLING_CHECKOUT_PRICE', '');
if (checkoutUrl) {
  const url = new URL(checkoutUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !checkoutPrice
  ) {
    throw new Error(
      'Configurá un enlace HTTPS y un precio para el piloto Pro.',
    );
  }
}

const mpToken = readString('MP_TEST_ACCESS_TOKEN', '');
const mpPayer = readString('MP_TEST_PAYER_EMAIL', '').toLowerCase();
const mpAmount = readNumber('MP_TEST_MONTHLY_ARS', 0);
const mpBackUrl = readString('MP_TEST_BACK_URL', '');

if (
  mpToken &&
  (!/^(TEST-|APP_USR-)/.test(mpToken) ||
    !mpPayer ||
    !Number.isFinite(mpAmount) ||
    mpAmount <= 0 ||
    mpAmount > 10000000 ||
    !mpBackUrl.startsWith('https://') ||
    new URL(mpBackUrl).protocol !== 'https:')
) {
  throw new Error(
    'Configuración incompleta del checkout de prueba de Mercado Pago.',
  );
}

const mpWebhookSecret = readString('MP_WEBHOOK_SECRET', '');
const mpCollectorId = readString('MP_WEBHOOK_COLLECTOR_ID', '');
if (mpWebhookSecret && (!mpToken || !/^\d+$/.test(mpCollectorId))) {
  throw new Error(
    'Los webhooks requieren el token y el identificador del vendedor de Mercado Pago.',
  );
}

const supportEmail = readString('SUPPORT_EMAIL', '');
if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail))
  throw new Error('SUPPORT_EMAIL no es un correo válido.');
const donationUrl = readString('DONATION_CHECKOUT_URL', '');
if (donationUrl) {
  const u = new URL(donationUrl);
  const validDestination =
    (u.hostname === 'link.mercadopago.com.ar' && u.pathname !== '/') ||
    (u.hostname === 'www.mercadopago.com.ar' &&
      u.pathname === '/checkout/v1/redirect' &&
      u.searchParams.has('pref_id'));
  if (u.protocol !== 'https:' || !validDestination || u.username || u.password)
    throw new Error('Usá un enlace HTTPS de Mercado Pago para las donaciones.');
}
const contactMailFrom = readString('CONTACT_MAIL_FROM', '');
if (/[\r\n]/.test(contactMailFrom))
  throw new Error('CONTACT_MAIL_FROM no es válido.');
const googleClientId = readString('GOOGLE_CLIENT_ID', '');
if (googleClientId && !/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(googleClientId)) throw new Error('GOOGLE_CLIENT_ID no es válido.');
const sponsorUrl = readString('ADS_SPONSOR_URL', '');
if (sponsorUrl) { const u = new URL(sponsorUrl); if(u.protocol !== 'https:' || u.username || u.password) throw new Error('ADS_SPONSOR_URL debe ser HTTPS sin credenciales.'); }
const adsProvider = readString('ADS_PROVIDER', 'sponsor');
if (!['sponsor','adsense'].includes(adsProvider)) throw new Error('ADS_PROVIDER debe ser sponsor o adsense.');
const adsenseClient = readString('ADSENSE_CLIENT_ID', '');
const adsenseSlot = readString('ADSENSE_SLOT_ID', '');
if (adsenseClient && !/^ca-pub-[0-9]{16}$/.test(adsenseClient)) throw new Error('ADSENSE_CLIENT_ID no es válido.');
if (adsenseSlot && !/^[0-9]{1,20}$/.test(adsenseSlot)) throw new Error('ADSENSE_SLOT_ID no es válido.');
export const env = {
  adsense: { client:adsenseClient, slot:adsenseSlot },
  advertising: { provider:adsProvider, enabled: readBoolean('ADS_ENABLED',false), name:readString('ADS_SPONSOR_NAME',''), description:readString('ADS_SPONSOR_DESCRIPTION',''), url:sponsorUrl },
  googleClientId,
  contactMail: {
    apiKey: readString('RESEND_API_KEY', ''),
    from: contactMailFrom,
  },
  community: {
    supportEmail,
    contactEnabled: readBoolean('CONTACT_FORM_ENABLED', false),
    donationUrl,
    donationsEnabled: readBoolean('DONATIONS_ENABLED', false),
    donationTestEnabled: readBoolean('DONATIONS_TEST_ENABLED', false),
  },
  mercadoPagoOneTimeEnabled: readBoolean('MP_ONE_TIME_ENABLED', false),
  mercadoPagoWebhook: { secret: mpWebhookSecret, collectorId: mpCollectorId },
  mercadoPagoTest: mpToken
    ? { token: mpToken, payer: mpPayer, amount: mpAmount, backUrl: mpBackUrl }
    : null,
  billing: {
    membershipsEnabled: readBoolean('BILLING_MEMBERSHIPS_ENABLED', false),
    checkout: checkoutUrl ? { url: checkoutUrl, price: checkoutPrice } : null,
  },
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
