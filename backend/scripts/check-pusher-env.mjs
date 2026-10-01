import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(__dirname, '../../.env');
const backendEnv = path.resolve(__dirname, '../.env');

console.log('cwd', process.cwd());
console.log('root .env exists', fs.existsSync(rootEnv));
console.log('backend/.env exists', fs.existsSync(backendEnv));

dotenv.config({ path: rootEnv });
console.log('after root dotenv', {
  PUSHER_APP_ID: process.env.PUSHER_APP_ID ?? '(missing)',
  PUSHER_KEY: process.env.PUSHER_KEY ? `len ${process.env.PUSHER_KEY.length}` : '(missing)',
  PUSHER_SECRET: process.env.PUSHER_SECRET ? 'set' : '(missing)',
  PUSHER_CLUSTER: process.env.PUSHER_CLUSTER ?? '(missing)',
});
