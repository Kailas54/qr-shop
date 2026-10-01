import { Router } from 'express';
import { login, me, refresh } from '../../controllers/adminAuthController';
import { asyncHandler } from '../../lib/asyncHandler';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { adminLoginLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { loginBodySchema, refreshBodySchema } from '../../validators/adminAuth';

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', adminLoginLimiter, validate(loginBodySchema), asyncHandler(login));
adminAuthRouter.post('/refresh', validate(refreshBodySchema), asyncHandler(refresh));
adminAuthRouter.get('/me', authenticateAdmin, asyncHandler(me));
