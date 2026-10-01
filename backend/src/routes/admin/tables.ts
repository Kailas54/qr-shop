import { Router } from 'express';
import * as tablesController from '../../controllers/tablesController';
import * as sessionsController from '../../controllers/sessionsController';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { requireRoles } from '../../middleware/requireRoles';
import { validate } from '../../middleware/validate';
import { ROLES_ALL_STAFF, ROLES_MANAGE_MENU_AND_TABLES, ROLES_MANAGE_TABLE_SESSIONS } from '../../lib/roles';
import { uuidParamSchema } from '../../validators/ids';
import { createTableBodySchema, tableQrQuerySchema, updateTableBodySchema } from '../../validators/tables';

export const adminTablesRouter = Router();

adminTablesRouter.use(authenticateAdmin);

adminTablesRouter.get('/', requireRoles(...ROLES_ALL_STAFF), tablesController.list);
adminTablesRouter.get('/qr/bulk.zip', requireRoles(...ROLES_MANAGE_MENU_AND_TABLES), tablesController.bulkQrZip);
adminTablesRouter.post('/', requireRoles(...ROLES_MANAGE_MENU_AND_TABLES), validate(createTableBodySchema), tablesController.create);
adminTablesRouter.post(
  '/:id/sessions',
  requireRoles(...ROLES_MANAGE_TABLE_SESSIONS),
  validate(uuidParamSchema, 'params'),
  sessionsController.openSessionForTable,
);
adminTablesRouter.patch(
  '/:id',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  validate(updateTableBodySchema),
  tablesController.update,
);
adminTablesRouter.get(
  '/:id/qr',
  requireRoles(...ROLES_ALL_STAFF),
  validate(uuidParamSchema, 'params'),
  validate(tableQrQuerySchema, 'query'),
  tablesController.qr,
);
