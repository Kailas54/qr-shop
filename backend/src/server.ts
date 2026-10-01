import { app } from './app';
import { env } from './config/env';
import { checkDatabaseConnection, prisma } from './lib/db';
import { logger } from './lib/logger';
import { isPusherConfigured } from './lib/pusher';
import { dbErrorFields } from './lib/redact';

async function main(): Promise<void> {
  try {
    await checkDatabaseConnection();
  } catch (error) {
    logger.fatal(dbErrorFields(error), 'database unavailable after retries');
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info(
      { port: env.PORT, realtime: isPusherConfigured() ? 'pusher' : 'rest-only' },
      'API listening',
    );
  });

  server.on('error', (error) => {
    logger.fatal({ err: error }, 'server failed to start');
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    server.close(() => {
      prisma
        .$disconnect()
        .catch((error: unknown) => {
          logger.error(dbErrorFields(error), 'error while disconnecting database');
        })
        .finally(() => {
          process.exit(0);
        });
    });
    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

void main();
