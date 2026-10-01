/**
 * Install dependencies for ../shared (used by admin-web / customer-web on Vercel).
 * TypeScript resolves `react` from shared/i18n relative to shared/node_modules.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sharedDir = path.join(root, 'shared');

execSync('npm install', {
  cwd: sharedDir,
  stdio: 'inherit',
  env: { ...process.env, npm_config_ignore_scripts: 'true' },
});
