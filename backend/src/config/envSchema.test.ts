import { describe, expect, it } from 'vitest';
import { parseEnv } from './envSchema';

function baseEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://qr:qr@localhost:5432/qr_ordering?schema=public&connection_limit=5',
    DIRECT_URL: 'postgresql://qr:qr@localhost:5432/qr_ordering?schema=public',
    JWT_SECRET: 'change-me-staff-jwt-secret-min-32-chars',
    GUEST_JWT_SECRET: 'change-me-guest-jwt-secret-min-32-chars',
    ...overrides,
  };
}

const neonDatabaseUrl =
  'postgresql://user:pass@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connection_limit=5';
const neonDirectUrl =
  'postgresql://user:pass@ep-example.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

describe('parseEnv', () => {
  it('accepts the local Docker connection strings', () => {
    const env = parseEnv(baseEnv());
    expect(env.PORT).toBe(4000);
    expect(env.PUSHER_CLUSTER).toBe('ap2');
    expect(env.SESSION_TTL_HOURS).toBe(3);
    expect(env.BCRYPT_COST).toBe(12);
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'http://localhost:5174']);
  });

  it('accepts a Neon pooled URL and a direct migration URL', () => {
    const env = parseEnv(
      baseEnv({
        DATABASE_URL: neonDatabaseUrl,
        DIRECT_URL: neonDirectUrl,
      }),
    );
    expect(env.DATABASE_URL).toContain('-pooler');
    expect(env.DIRECT_URL).not.toContain('-pooler');
  });

  it('rejects a missing database URL', () => {
    const source = baseEnv();
    delete source.DATABASE_URL;
    expect(() => parseEnv(source)).toThrow(/DATABASE_URL/);
  });

  it('rejects identical JWT secrets', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          GUEST_JWT_SECRET: 'change-me-staff-jwt-secret-min-32-chars',
        }),
      ),
    ).toThrow(/must be different/);
  });

  it('rejects a Neon URL without sslmode=require', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          DATABASE_URL:
            'postgresql://user:pass@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?connection_limit=5',
          DIRECT_URL: neonDirectUrl,
        }),
      ),
    ).toThrow(/sslmode=require/);
  });

  it('rejects a Neon runtime URL that is not pooled', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          DATABASE_URL: neonDirectUrl,
          DIRECT_URL: neonDirectUrl,
        }),
      ),
    ).toThrow(/pooled host/);
  });

  it('rejects a pooled URL for migrations', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          DATABASE_URL: neonDatabaseUrl,
          DIRECT_URL: neonDatabaseUrl,
        }),
      ),
    ).toThrow(/DIRECT_URL/);
  });

  it('rejects a Neon pool larger than 10 connections', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          DATABASE_URL:
            'postgresql://user:pass@ep-example-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&connection_limit=20',
          DIRECT_URL: neonDirectUrl,
        }),
      ),
    ).toThrow(/connection_limit/);
  });

  it('requires Pusher credentials in production and refuses placeholder secrets', () => {
    expect(() =>
      parseEnv(
        baseEnv({
          NODE_ENV: 'production',
          DATABASE_URL: neonDatabaseUrl,
          DIRECT_URL: neonDirectUrl,
          JWT_SECRET: 'a-real-staff-secret-with-enough-length',
          GUEST_JWT_SECRET: 'a-real-guest-secret-with-enough-length',
        }),
      ),
    ).toThrow(/PUSHER_APP_ID/);
  });

  it('requires Cloudinary keys when that provider is selected', () => {
    expect(() => parseEnv(baseEnv({ STORAGE_PROVIDER: 'cloudinary' }))).toThrow(/CLOUDINARY_CLOUD_NAME/);
  });
});
