import { Router } from 'express';
import * as sessionsController from '../../controllers/sessionsController';
import { publicRealtimeConfig } from '../../controllers/realtimeController';
import { authenticateGuest } from '../../middleware/authenticateGuest';
import { pinJoinLimiter } from '../../middleware/rateLimit';
import { validate } from '../../middleware/validate';
import { joinSessionBodySchema } from '../../validators/sessions';

export const publicRouter = Router();

publicRouter.get('/realtime-config', publicRealtimeConfig);
publicRouter.get('/tables/:qrToken', sessionsController.getPublicTable);
publicRouter.post(
  '/sessions/join',
  validate(joinSessionBodySchema),
  pinJoinLimiter,
  sessionsController.joinSession,
);
publicRouter.get('/sessions/me', authenticateGuest, sessionsController.guestSessionMe);
