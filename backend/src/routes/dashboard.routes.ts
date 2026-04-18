import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';

export const dashboardRouter = Router({ mergeParams: true });

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

dashboardRouter.use(authenticate as any);
dashboardRouter.use(requireWorkspace as any);

dashboardRouter.get('/', asyncHandler(dashboardController.getProjectDashboard.bind(dashboardController)));
dashboardRouter.get('/personal', asyncHandler(dashboardController.getPersonalDashboard.bind(dashboardController)));
