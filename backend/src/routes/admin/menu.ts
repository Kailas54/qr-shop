import { Router } from 'express';
import * as menuController from '../../controllers/menuController';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { requireRoles } from '../../middleware/requireRoles';
import { uploadMenuImage } from '../../middleware/uploadMenuImage';
import { validate } from '../../middleware/validate';
import { ROLES_ALL_STAFF, ROLES_MANAGE_MENU_AND_TABLES } from '../../lib/roles';
import { uuidParamSchema } from '../../validators/ids';
import {
  createCategoryBodySchema,
  createMenuItemBodySchema,
  toggleAvailabilityBodySchema,
  updateCategoryBodySchema,
  updateMenuItemBodySchema,
} from '../../validators/menu';

export const adminMenuRouter = Router();

adminMenuRouter.use(authenticateAdmin);

adminMenuRouter.get('/categories', requireRoles(...ROLES_ALL_STAFF), menuController.listCategoriesHandler);
adminMenuRouter.post(
  '/categories',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(createCategoryBodySchema),
  menuController.createCategoryHandler,
);
adminMenuRouter.patch(
  '/categories/:id',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  validate(updateCategoryBodySchema),
  menuController.updateCategoryHandler,
);
adminMenuRouter.delete(
  '/categories/:id',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  menuController.deleteCategoryHandler,
);

adminMenuRouter.get('/items', requireRoles(...ROLES_ALL_STAFF), menuController.listItemsHandler);
adminMenuRouter.post(
  '/items',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(createMenuItemBodySchema),
  menuController.createItemHandler,
);
adminMenuRouter.patch(
  '/items/:id',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  validate(updateMenuItemBodySchema),
  menuController.updateItemHandler,
);
adminMenuRouter.delete(
  '/items/:id',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  menuController.deleteItemHandler,
);
adminMenuRouter.patch(
  '/items/:id/availability',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  validate(toggleAvailabilityBodySchema),
  menuController.toggleAvailabilityHandler,
);
adminMenuRouter.post(
  '/items/:id/image',
  requireRoles(...ROLES_MANAGE_MENU_AND_TABLES),
  validate(uuidParamSchema, 'params'),
  (req, res, next) => {
    uploadMenuImage.single('image')(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }
      next();
    });
  },
  menuController.uploadItemImageHandler,
);
