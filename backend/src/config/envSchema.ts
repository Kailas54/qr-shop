import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  GUEST_JWT_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  JWT_REFRESH_TTL: z.string().min(1).default('7d'),
  PUSHER_APP_ID: z.string().default(''),
  PUSHER_KEY: z.string().default(''),
  PUSHER_SECRET: z.string().default(''),
  PUSHER_CLUSTER: z.string().min(1).default('ap2'),
  CUSTOMER_APP_URL: z.string().url().default('http://localhost:5173'),
  ADMIN_APP_URL: z.string().url().default('http://localhost:5174'),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5174'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(3),
  STORAGE_PROVIDER: z.enum(['local', 'cloudinary', 'vercel_blob']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().min(1).default('uploads'),
  CLOUDINARY_CLOUD_NAME: z.string().default(''),
  CLOUDINARY_API_KEY: z.string().default(''),
  CLOUDINARY_API_SECRET: z.string().default(''),
  BLOB_READ_WRITE_TOKEN: z.string().default(''),
  MAX_ITEMS_PER_ORDER: z.coerce.number().int().positive().default(30),
  MAX_QTY_PER_ITEM: z.coerce.number().int().positive().default(20),
  ORDER_VALUE_REVIEW_THRESHOLD: z.coerce.number().int().nonnegative().default(500000),
  BCRYPT_COST: z.coerce.number().int().min(12).max(15).default(12),
});

export type AppEnv = z.infer<typeof envSchema> & {
  corsOrigins: string[];
};

function readDatabaseUrl(label: string, value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
}

function isNeonHost(hostname: string): boolean {
  return hostname.toLowerCase().includes('neon.tech');
}

function assertSslForNeon(label: string, url: URL): void {
  if (!isNeonHost(url.hostname)) {
    return;
  }
  const sslmode = url.searchParams.get('sslmode')?.toLowerCase();
  if (sslmode !== 'require') {
    throw new Error(`${label} must include sslmode=require for Neon`);
  }
}

/** Align with `backend/scripts/set-neon-env.mjs` so pasted Neon console URLs work on Render. */
export function normalizeDatabaseUrls(
  databaseUrl: string,
  directUrl: string,
): { databaseUrl: string; directUrl: string } {
  const database = readDatabaseUrl('DATABASE_URL', databaseUrl);
  const direct = readDatabaseUrl('DIRECT_URL', directUrl);

  if (isNeonHost(database.hostname)) {
    if (database.searchParams.get('sslmode')?.toLowerCase() !== 'require') {
      database.searchParams.set('sslmode', 'require');
    }
    if (!database.searchParams.get('connection_limit')) {
      database.searchParams.set('connection_limit', '5');
    }
    if (!database.searchParams.get('pool_timeout')) {
      database.searchParams.set('pool_timeout', '10');
    }
    if (!database.searchParams.get('connect_timeout')) {
      database.searchParams.set('connect_timeout', '15');
    }
    databaseUrl = database.toString();
  }

  if (isNeonHost(direct.hostname)) {
    if (direct.searchParams.get('sslmode')?.toLowerCase() !== 'require') {
      direct.searchParams.set('sslmode', 'require');
    }
    directUrl = direct.toString();
  }

  return { databaseUrl, directUrl };
}

/**
 * Neon free tier: the API must use the pooled host, migrations the direct host,
 * TLS is required, and the Prisma pool stays at or below 10 connections.
 */
export function validateDatabaseUrls(databaseUrl: string, directUrl: string): void {
  const database = readDatabaseUrl('DATABASE_URL', databaseUrl);
  const direct = readDatabaseUrl('DIRECT_URL', directUrl);

  assertSslForNeon('DATABASE_URL', database);
  assertSslForNeon('DIRECT_URL', direct);

  const databaseHost = database.hostname.toLowerCase();
  const directHost = direct.hostname.toLowerCase();
  const databaseIsNeon = databaseHost.includes('neon.tech');

  if (databaseIsNeon && !databaseHost.includes('-pooler')) {
    throw new Error('DATABASE_URL must use the Neon pooled host (hostname contains -pooler)');
  }

  if (directHost.includes('-pooler')) {
    throw new Error('DIRECT_URL must be the direct database host, not the pooled (-pooler) host');
  }

  if (databaseIsNeon) {
    const rawLimit = database.searchParams.get('connection_limit');
    const limit = rawLimit === null ? NaN : Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) {
      throw new Error('DATABASE_URL for Neon must set connection_limit to an integer from 1 to 10');
    }
  }
}

function assertProductionSecrets(env: z.infer<typeof envSchema>): void {
  if (env.NODE_ENV !== 'production') {
    return;
  }

  if (env.JWT_SECRET === env.GUEST_JWT_SECRET) {
    throw new Error('JWT_SECRET and GUEST_JWT_SECRET must be different');
  }

  for (const key of ['JWT_SECRET', 'GUEST_JWT_SECRET'] as const) {
    const value = env[key];
    if (value.startsWith('dev-') || value.includes('change-me')) {
      throw new Error(`${key} is still a placeholder. Set a real secret in production.`);
    }
  }

  for (const key of ['PUSHER_APP_ID', 'PUSHER_KEY', 'PUSHER_SECRET'] as const) {
    if (!env[key]) {
      throw new Error(`${key} is required when NODE_ENV=production`);
    }
  }
}

function assertStorage(env: z.infer<typeof envSchema>): void {
  if (env.STORAGE_PROVIDER === 'cloudinary') {
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new Error(
        'STORAGE_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET',
      );
    }
  }

  if (env.STORAGE_PROVIDER === 'vercel_blob' && !env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('STORAGE_PROVIDER=vercel_blob requires BLOB_READ_WRITE_TOKEN');
  }
}

export function parseEnv(source: NodeJS.ProcessEnv): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const data = parsed.data;
  if (data.JWT_SECRET === data.GUEST_JWT_SECRET) {
    throw new Error('Invalid environment: JWT_SECRET and GUEST_JWT_SECRET must be different');
  }

  const dbUrls = normalizeDatabaseUrls(data.DATABASE_URL, data.DIRECT_URL);
  validateDatabaseUrls(dbUrls.databaseUrl, dbUrls.directUrl);
  if (dbUrls.databaseUrl !== data.DATABASE_URL) {
    process.env.DATABASE_URL = dbUrls.databaseUrl;
  }
  if (dbUrls.directUrl !== data.DIRECT_URL) {
    process.env.DIRECT_URL = dbUrls.directUrl;
  }
  assertProductionSecrets(data);
  assertStorage(data);

  const pusherValues = [data.PUSHER_APP_ID, data.PUSHER_KEY, data.PUSHER_SECRET];
  const pusherSet = pusherValues.filter((value) => value.length > 0).length;
  if (pusherSet !== 0 && pusherSet !== pusherValues.length) {
    throw new Error('Invalid environment: set PUSHER_APP_ID, PUSHER_KEY, and PUSHER_SECRET together');
  }

  const corsOrigins = data.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (corsOrigins.length === 0) {
    throw new Error('Invalid environment: CORS_ORIGINS must list at least one origin');
  }

  return {
    ...data,
    DATABASE_URL: dbUrls.databaseUrl,
    DIRECT_URL: dbUrls.directUrl,
    corsOrigins,
  };
}
