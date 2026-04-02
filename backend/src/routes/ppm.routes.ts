import { Router, Response } from 'express';
import { ppmController } from '../controllers/ppm.controller';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';

const router = Router();
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// Apply auth to all PPM routes
router.use(authenticate as any);

// === PORTFOLIOS & PROGRAMS ===
router.post('/portfolios/:portfolioId/programs', asyncHandler(ppmController.createProgram));
router.get('/portfolios/:portfolioId/programs', asyncHandler(ppmController.getPrograms));
router.get('/portfolios/:portfolioId/financials', asyncHandler(ppmController.getFinancials));

// === TIMESHEETS ===
// These routes need workspace context
router.get('/timesheets', requireWorkspace as any, asyncHandler(ppmController.getTimesheet));
router.post('/timesheets/:timesheetId/logs', requireWorkspace as any, asyncHandler(ppmController.logTime));

// === TASK ASSIGNMENTS & DEPENDENCIES ===
router.post('/tasks/:taskId/assignments', requireWorkspace as any, asyncHandler(ppmController.assignTask));
router.post('/tasks/dependencies', requireWorkspace as any, asyncHandler(ppmController.addDependency));

export const ppmRoutes = router;
