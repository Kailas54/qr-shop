import { Router } from 'express';
import * as adminOrdersController from '../../controllers/adminOrdersController';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { requireRoles } from '../../middleware/requireRoles';
import { validate } from '../../middleware/validate';
import { ROLES_ALL_STAFF } from '../../lib/roles';
import { uuidParamSchema } from '../../validators/ids';
import { listAdminOrdersQuerySchema, updateOrderStatusBodySchema } from '../../validators/adminOrders';

export const adminOrdersRouter = Router();

adminOrdersRouter.use(authenticateAdmin);

adminOrdersRouter.get(
  '/',
  requireRoles(...ROLES_ALL_STAFF),
  validate(listAdminOrdersQuerySchema, 'query'),
  adminOrdersController.list,
);
adminOrdersRouter.get(
  '/:id',
  requireRoles(...ROLES_ALL_STAFF),
  validate(uuidParamSchema, 'params'),
  adminOrdersController.detail,
);
adminOrdersRouter.patch(
  '/:id/status',
  requireRoles(...ROLES_ALL_STAFF),
  validate(uuidParamSchema, 'params'),
  validate(updateOrderStatusBodySchema),
  adminOrdersController.updateStatus,
);
adminOrdersRouter.post(
  '/:id/confirm',
  requireRoles(...ROLES_ALL_STAFF),
  validate(uuidParamSchema, 'params'),
  adminOrdersController.confirm,
);
