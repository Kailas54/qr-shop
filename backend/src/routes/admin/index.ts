import { Router } from 'express';
import { staffRealtimeConfig } from '../../controllers/realtimeController';
import { authenticateAdmin } from '../../middleware/authenticateAdmin';
import { adminAuthRouter } from './auth';
import { adminMenuRouter } from './menu';
import { adminOrdersRouter } from './orders';
import { adminSessionsRouter } from './sessions';
import { adminTablesRouter } from './tables';

export const adminRouter = Router();

adminRouter.use('/auth', adminAuthRouter);
adminRouter.get('/realtime-config', authenticateAdmin, staffRealtimeConfig);
adminRouter.use('/tables', adminTablesRouter);
adminRouter.use('/sessions', adminSessionsRouter);
adminRouter.use('/orders', adminOrdersRouter);
adminRouter.use('/menu', adminMenuRouter);
