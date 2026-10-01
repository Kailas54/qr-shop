import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { HttpError } from '../lib/errors';
import { logger } from '../lib/logger';
import { dbErrorFields } from '../lib/redact';

type BodyLimitError = Error & { type?: string; status?: number };

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route not found: ${req.method} ${req.path}`,
    },
  });
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  let status = 500;
  let code = 'INTERNAL';
  let message = 'Something went wrong';

  if (err instanceof HttpError) {
    status = err.status;
    code = err.code;
    message = err.message;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = err.issues.map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`).join('; ');
  } else if (err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientKnownRequestError) {
    const unavailable = err instanceof Prisma.PrismaClientInitializationError || err.code === 'P1001' || err.code === 'P1017';
    if (unavailable) {
      status = 503;
      code = 'DB_UNAVAILABLE';
      message = 'Database is not reachable';
    }
  } else if (isBodyLimitError(err)) {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (err instanceof multer.MulterError) {
    status = 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 2MB or smaller' : err.message;
  }

  const logPayload = {
    requestId: req.id,
    code,
    status,
    err: err instanceof Prisma.PrismaClientInitializationError || err instanceof Prisma.PrismaClientKnownRequestError
      ? dbErrorFields(err)
      : err,
  };

  if (status >= 500) {
    logger.error(logPayload, message);
  } else {
    logger.warn(logPayload, message);
  }

  res.status(status).json({ error: { code, message } });
}

function isBodyLimitError(err: unknown): err is BodyLimitError {
  return err instanceof Error && (err as BodyLimitError).type === 'entity.too.large';
}
