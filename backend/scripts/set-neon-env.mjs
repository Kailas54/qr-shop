/**
 * Write Neon connection strings into root .env (DATABASE_URL + DIRECT_URL).
 *
 * PowerShell:
 *   $env:NEON_POOLED="postgresql://..."
 *   $env:NEON_DIRECT="postgresql://..."
 *   node backend/scripts/set-neon-env.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../../.env');

const pooled = process.env.NEON_POOLED?.trim();
const direct = process.env.NEON_DIRECT?.trim();

if (!pooled || !direct) {
  console.error('Set NEON_POOLED and NEON_DIRECT environment variables first.');
  console.error('Get both strings from https://console.neon.tech → your project → Connect.');
  process.exit(1);
}

function ensurePooledUrl(url) {
  const parsed = new URL(url);
  if (!parsed.hostname.includes('neon.tech')) {
    throw new Error('NEON_POOLED does not look like a Neon URL');
  }
  if (!parsed.hostname.includes('-pooler')) {
    throw new Error('NEON_POOLED host must contain "-pooler" (use the pooled connection string)');
  }
  if (parsed.searchParams.get('sslmode') !== 'require') {
    parsed.searchParams.set('sslmode', 'require');
  }
  if (!parsed.searchParams.get('connection_limit')) {
    parsed.searchParams.set('connection_limit', '5');
  }
  if (!parsed.searchParams.get('pool_timeout')) {
    parsed.searchParams.set('pool_timeout', '10');
  }
  if (!parsed.searchParams.get('connect_timeout')) {
    parsed.searchParams.set('connect_timeout', '15');
  }
  return parsed.toString();
}

function ensureDirectUrl(url) {
  const parsed = new URL(url);
  if (!parsed.hostname.includes('neon.tech')) {
    throw new Error('NEON_DIRECT does not look like a Neon URL');
  }
  if (parsed.hostname.includes('-pooler')) {
    throw new Error('NEON_DIRECT must be the direct host (no "-pooler" in hostname)');
  }
  if (parsed.searchParams.get('sslmode') !== 'require') {
    parsed.searchParams.set('sslmode', 'require');
  }
  return parsed.toString();
}

let databaseUrl;
let directUrl;
try {
  databaseUrl = ensurePooledUrl(pooled);
  directUrl = ensureDirectUrl(direct);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(1);
}

let text = fs.readFileSync(envPath, 'utf8');
const dbLine = `DATABASE_URL=${databaseUrl}`;
const directLine = `DIRECT_URL=${directUrl}`;

if (/^DATABASE_URL=.*$/m.test(text)) {
  text = text.replace(/^DATABASE_URL=.*$/m, dbLine);
} else {
  text += `\n${dbLine}\n`;
}
if (/^DIRECT_URL=.*$/m.test(text)) {
  text = text.replace(/^DIRECT_URL=.*$/m, directLine);
} else {
  text += `${directLine}\n`;
}

fs.writeFileSync(envPath, text);
console.log('Updated .env with Neon DATABASE_URL and DIRECT_URL.');
console.log('Next: npm run setup   (migrate + seed)');
console.log('You can stop local Postgres: npm run db:local:stop');
