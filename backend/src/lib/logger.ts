import pino from 'pino';
import { env } from '../config/env';

export const logger = pino({
  level: process.env.VITEST || env.NODE_ENV === 'test' ? 'silent' : env.NODE_ENV === 'development' ? 'debug' : 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'pin',
      'pinHash',
      'token',
      'accessToken',
      'refreshToken',
      '*.password',
      '*.passwordHash',
      '*.pin',
      '*.pinHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken',
      '*.authorization',
    ],
    censor: '[redacted]',
  },
});
