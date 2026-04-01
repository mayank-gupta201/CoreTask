import { Router } from 'express';
import { authRouter } from './auth.routes';
import { taskRouter } from './task.routes';
import { workspaceRouter } from './workspace.routes';
import { templateRouter } from './template.routes';
import { chatRouter } from './chat.routes';
import { webhookRouter } from './github-webhook.routes';
import { apiLimiter, authLimiter } from '../middlewares/rateLimiter.middleware';

export const apiRouter = Router();

apiRouter.use('/auth', authLimiter as any, authRouter);
apiRouter.use('/workspaces', apiLimiter as any, workspaceRouter);
apiRouter.use('/tasks', apiLimiter as any, taskRouter);
apiRouter.use('/templates', apiLimiter as any, templateRouter);
apiRouter.use('/chat', apiLimiter as any, chatRouter);

// Feature 7: Webhook routes — no rate limiter (GitHub may retry on failure)
apiRouter.use('/webhooks', webhookRouter);
