import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from './logger';
import { dbErrorFields } from './redact';
import { withRetry } from './retry';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/** Wake Neon and confirm the pooled connection. Used by startup and GET /health. */
export async function checkDatabaseConnection(): Promise<void> {
  await withRetry(() => prisma.$queryRaw`SELECT 1`, {
    attempts: 3,
    baseDelayMs: 200,
    onError: (error, attempt) => {
      logger.warn({ attempt, ...dbErrorFields(error) }, 'database connection attempt failed');
    },
  });
}
