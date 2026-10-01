/**
 * Local PostgreSQL without Docker (embedded-postgres).
 * Usage: node scripts/local-postgres.mjs start|stop|status
 */
import { spawn } from 'child_process';
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'fs';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const statePath = path.join(repoRoot, '.local', 'postgres.json');
const databaseDir = path.join(repoRoot, '.local', 'postgres-data');

const PG_USER = 'qr';
const PG_PASSWORD = 'qr';
const PG_DATABASE = 'qr_ordering';
const PG_PORT = Number(process.env.LOCAL_PG_PORT ?? 5432);

function readState() {
  if (!fs.existsSync(statePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function removeState() {
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
}

function portInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close(() => resolve(false));
    });
    server.listen(port, '127.0.0.1');
  });
}

function resolvePgCtl() {
  const platformPkg =
    process.platform === 'win32'
      ? '@embedded-postgres/windows-x64'
      : process.platform === 'darwin'
        ? process.arch === 'arm64'
          ? '@embedded-postgres/darwin-arm64'
          : '@embedded-postgres/darwin-x64'
        : '@embedded-postgres/linux-x64';

  const pgCtlName = process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl';
  const pgCtlPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'node_modules',
    platformPkg,
    'native',
    'bin',
    pgCtlName,
  );

  if (!fs.existsSync(pgCtlPath)) {
    throw new Error(
      `Could not find ${pgCtlName}. Run npm install in backend/ (embedded-postgres downloads platform binaries on install).`,
    );
  }
  return pgCtlPath;
}

async function stopPostgres() {
  const state = readState();
  const dir = state?.databaseDir ?? databaseDir;

  if (!fs.existsSync(dir)) {
    removeState();
    console.log('Local Postgres is not running (no data directory).');
    return;
  }

  const pgCtl = resolvePgCtl();
  await new Promise((resolve, reject) => {
    const child = spawn(pgCtl, ['stop', '-D', dir, '-m', 'fast'], { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0 || code === 1) {
        resolve();
        return;
      }
      reject(new Error(`pg_ctl stop exited with code ${code}`));
    });
  });

  removeState();
  console.log('Local Postgres stopped.');
}

async function statusPostgres() {
  const busy = await portInUse(PG_PORT);
  const state = readState();
  if (busy && state) {
    console.log(`Local Postgres is listening on 127.0.0.1:${PG_PORT} (database ${PG_DATABASE}).`);
    return;
  }
  if (busy) {
    console.log(`Port ${PG_PORT} is in use, but not by this project's embedded Postgres.`);
    return;
  }
  console.log(`Port ${PG_PORT} is free. Run: npm run db:local:start`);
}

async function startPostgres() {
  const busy = await portInUse(PG_PORT);
  if (busy) {
    const state = readState();
    if (state?.port === PG_PORT) {
      console.log(`Local Postgres already running on port ${PG_PORT}.`);
      return;
    }
    throw new Error(
      `Port ${PG_PORT} is already in use. Stop the other service or set LOCAL_PG_PORT and update DATABASE_URL / DIRECT_URL in .env.`,
    );
  }

  const pg = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
    onLog: (message) => process.stdout.write(`${String(message).trimEnd()}\n`),
    onError: (message) => process.stderr.write(`${String(message).trimEnd()}\n`),
  });

  if (!fs.existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    await pg.initialise();
  }

  await pg.start();

  try {
    await pg.createDatabase(PG_DATABASE);
    console.log(`Created database "${PG_DATABASE}".`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/already exists/i.test(message)) {
      throw error;
    }
  }

  writeState({
    port: PG_PORT,
    databaseDir,
    user: PG_USER,
    database: PG_DATABASE,
    startedAt: new Date().toISOString(),
  });

  console.log(`Local Postgres ready on 127.0.0.1:${PG_PORT} (user ${PG_USER}, database ${PG_DATABASE}).`);
  console.log('Leave this process running. Stop with: npm run db:local:stop');

  const shutdown = async () => {
    try {
      await pg.stop();
    } catch {
      // ignore
    }
    removeState();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await new Promise(() => {});
}

const command = process.argv[2] ?? 'start';

try {
  if (command === 'start') {
    await startPostgres();
  } else if (command === 'stop') {
    await stopPostgres();
  } else if (command === 'status') {
    await statusPostgres();
  } else {
    console.error('Usage: node scripts/local-postgres.mjs start|stop|status');
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
