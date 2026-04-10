import { Router } from 'express';
import { authRouter } from './auth.routes';
import { taskRouter } from './task.routes';
import { workspaceRouter } from './workspace.routes';
import { templateRouter } from './template.routes';
import { chatRouter } from './chat.routes';
import { portfolioRouter } from './portfolio.routes';
import { dependencyRoutes } from './dependency.routes';
import { resourceRoutes } from './resource.routes';
import { ppmRoutes } from './ppm.routes';
import { webhookRouter } from './github-webhook.routes';
import { apiLimiter, authLimiter } from '../middlewares/rateLimiter.middleware';

export const apiRouter = Router();

apiRouter.use('/auth', authLimiter as any, authRouter);
apiRouter.use('/workspaces', apiLimiter as any, workspaceRouter);
apiRouter.use('/portfolios', apiLimiter as any, portfolioRouter);
apiRouter.use('/tasks', apiLimiter as any, taskRouter);
apiRouter.use('/templates', apiLimiter as any, templateRouter);
apiRouter.use('/chat', apiLimiter as any, chatRouter);

// PROMPT 1C: Dependencies + Gantt (mapped under workspaces scope)
apiRouter.use('/workspaces/:workspaceId', apiLimiter as any, dependencyRoutes);

// PROMPT 2A: Resource Management Context
apiRouter.use('/workspaces/:workspaceId', apiLimiter as any, resourceRoutes);

// Feature 7: Webhook routes — no rate limiter (GitHub may retry on failure)
apiRouter.use('/webhooks', webhookRouter);
