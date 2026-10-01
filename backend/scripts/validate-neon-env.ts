import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { validateDatabaseUrls } from '../src/config/envSchema';

const repoEnv = path.resolve(__dirname, '../../.env');
if (!fs.existsSync(repoEnv)) {
  console.error('Missing root .env — copy .env.example to .env first.');
  process.exit(1);
}

dotenv.config({ path: repoEnv, override: true });

const databaseUrl = process.env.DATABASE_URL ?? '';
const directUrl = process.env.DIRECT_URL ?? '';

try {
  validateDatabaseUrls(databaseUrl, directUrl);
  const dbHost = new URL(databaseUrl).hostname;
  if (dbHost.includes('neon.tech')) {
    console.log('Neon URLs look valid.');
    console.log(`  DATABASE_URL host: ${dbHost}`);
    console.log(`  DIRECT_URL host:   ${new URL(directUrl).hostname}`);
    process.exit(0);
  }
  console.log('URLs validate, but host is not neon.tech (local or other Postgres is fine).');
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error('\nNeon checklist:');
  console.error('  - DATABASE_URL: host must contain "-pooler", sslmode=require, connection_limit=1..10');
  console.error('  - DIRECT_URL: same user/db, host WITHOUT "-pooler", sslmode=require');
  process.exit(1);
}
