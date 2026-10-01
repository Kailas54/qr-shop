import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { parseEnv } from './envSchema';

// Monorepo root `.env` first; optional `backend/.env` overrides for local dev.
const candidates = [
  path.resolve(__dirname, '../../../.env'),
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../.env'),
];

const loaded = new Set<string>();
for (const candidate of candidates) {
  const normalized = path.normalize(candidate);
  if (loaded.has(normalized) || !fs.existsSync(candidate)) {
    continue;
  }
  loaded.add(normalized);
  dotenv.config({ path: candidate, override: true });
}

export const env = parseEnv(process.env);
export type { AppEnv } from './envSchema';
