import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import pinoHttp from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { globalLimiter } from './middleware/rateLimit';
import { requestId } from './middleware/requestId';
import { adminRouter } from './routes/admin';
import { healthRouter } from './routes/health';
import { ordersRouter } from './routes/orders';
import { publicRouter } from './routes/public';
import { openapiRouter } from './routes/openapi';
import { pusherRouter } from './routes/pusher';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', env.NODE_ENV === 'production' ? 1 : false);

app.use(requestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const existing = (req as express.Request).id;
      if (existing) {
        return existing;
      }
      const created = res.getHeader('x-request-id');
      return typeof created === 'string' ? created : 'unknown';
    },
    autoLogging: {
      ignore: (req) => req.url?.split('?')[0] === '/health',
    },
  }),
);
app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigins,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  }),
);
app.use(globalLimiter);
app.use(express.json({ limit: '100kb' }));

if (env.STORAGE_PROVIDER === 'local') {
  const uploadDir = path.isAbsolute(env.LOCAL_UPLOAD_DIR)
    ? env.LOCAL_UPLOAD_DIR
    : path.resolve(process.cwd(), env.LOCAL_UPLOAD_DIR);
  app.use('/uploads', express.static(uploadDir));
}

app.get('/', (_req, res) => {
  res.json({ name: 'qr-ordering-api', status: 'ok' });
});

app.use(healthRouter);
app.use('/api', openapiRouter);
app.use('/api/admin', adminRouter);
app.use('/api/public', publicRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/pusher', pusherRouter);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
