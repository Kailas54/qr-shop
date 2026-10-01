import type { AdminRole } from '@prisma/client';
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from '../lib/errors';

export function requireRoles(...allowed: AdminRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.admin) {
      next(new HttpError(401, 'UNAUTHORIZED', 'Authentication required'));
      return;
    }
    if (!allowed.includes(req.admin.role)) {
      next(new HttpError(403, 'FORBIDDEN', 'You do not have permission for this action'));
      return;
    }
    next();
  };
}
