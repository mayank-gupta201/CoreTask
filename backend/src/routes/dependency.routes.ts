import { Router } from 'express';
import { dependencyController, addDependencySchema } from '../controllers/dependency.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { checkPermission } from '../middlewares/permission.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router({ mergeParams: true });
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// Apply auth and workspace context naturally
router.use(authenticate as any);
router.use(requireWorkspace as any);

// POST /api/workspaces/:workspaceId/tasks/:taskId/dependencies
router.post(
    '/tasks/:taskId/dependencies', 
    checkPermission('dependency:manage') as any,
    validate(addDependencySchema),
    asyncHandler(dependencyController.addDependency)
);

// DELETE /api/workspaces/:workspaceId/dependencies/:dependencyId
router.delete(
    '/dependencies/:dependencyId',
    checkPermission('dependency:manage') as any,
    asyncHandler(dependencyController.removeDependency)
);

// GET /api/workspaces/:workspaceId/gantt
router.get(
    '/gantt',
    checkPermission('dashboard:read') as any,
    asyncHandler(dependencyController.getGanttData)
);

export const dependencyRoutes = router;
