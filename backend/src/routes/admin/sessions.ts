import { Router } from 'express';
import * as sessionsController from '../../controllers/sessionsController';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { requireRoles } from '../../middleware/requireRoles';
import { validate } from '../../middleware/validate';
import { ROLES_MANAGE_TABLE_SESSIONS } from '../../lib/roles';
import { uuidParamSchema } from '../../validators/ids';
import { listSessionsQuerySchema } from '../../validators/sessions';

export const adminSessionsRouter = Router();

adminSessionsRouter.use(authenticateAdmin);

adminSessionsRouter.get(
  '/',
  requireRoles(...ROLES_MANAGE_TABLE_SESSIONS),
  validate(listSessionsQuerySchema, 'query'),
  sessionsController.listAdminSessions,
);
adminSessionsRouter.post(
  '/:id/close',
  requireRoles(...ROLES_MANAGE_TABLE_SESSIONS),
  validate(uuidParamSchema, 'params'),
  sessionsController.closeSession,
);
adminSessionsRouter.post(
  '/:id/regenerate-pin',
  requireRoles(...ROLES_MANAGE_TABLE_SESSIONS),
  validate(uuidParamSchema, 'params'),
  sessionsController.regeneratePin,
);
adminSessionsRouter.post(
  '/:id/flag',
  requireRoles(...ROLES_MANAGE_TABLE_SESSIONS),
  validate(uuidParamSchema, 'params'),
  sessionsController.flagSession,
);
