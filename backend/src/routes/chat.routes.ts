import { Router } from 'express';
import { chatController, chatMessageSchema } from '../controllers/chat.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { aiLimiter } from '../middlewares/rateLimiter.middleware';

export const chatRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

chatRouter.use(authenticate as any);
chatRouter.use(requireWorkspace as any);

// Feature 4: AI rate limiter applied to chat endpoint
chatRouter.post('/', aiLimiter as any, validate(chatMessageSchema), asyncHandler(chatController.chat));
