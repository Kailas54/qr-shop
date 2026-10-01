import { Router } from 'express';
import { auth } from '../controllers/pusherController';
import { validate } from '../middleware/validate';
import { pusherAuthBodySchema } from '../validators/pusher';

export const pusherRouter = Router();

pusherRouter.post('/auth', validate(pusherAuthBodySchema), auth);
