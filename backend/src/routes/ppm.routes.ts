import { Router, Response } from 'express';
import { ppmController } from '../controllers/ppm.controller';
import { authenticate, AuthRequest } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { validate } from '../middlewares/validate.middleware';
import { z } from 'zod';

const router = Router();
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// Validation schemas for PPM-specific mutations
const createProgramBodySchema = z.object({
    body: z.object({
        portfolioId: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
    }),
});

const logTimeBodySchema = z.object({
    body: z.object({
        taskId: z.string().uuid().optional().nullable(),
        logDate: z.string(),
        hours: z.number().min(0.1).max(24),
        notes: z.string().optional(),
    }),
});

const assignTaskBodySchema = z.object({
    body: z.object({
        userId: z.string().uuid(),
        allocationPercent: z.number().min(1).max(100).optional(),
    }),
});

const addDependencyBodySchema = z.object({
    body: z.object({
        predecessorId: z.string().uuid(),
        successorId: z.string().uuid(),
        type: z.enum(['FS', 'SS', 'FF', 'SF']),
        lagDays: z.number().int().optional(),
    }),
});

// Apply auth to all PPM routes
router.use(authenticate as any);

// === PORTFOLIOS & PROGRAMS ===
router.post('/portfolios/:portfolioId/programs', validate(createProgramBodySchema), asyncHandler(ppmController.createProgram));
router.get('/portfolios/:portfolioId/programs', asyncHandler(ppmController.getPrograms));
router.get('/portfolios/:portfolioId/financials', asyncHandler(ppmController.getFinancials));

// === TIMESHEETS ===
// These routes need workspace context
router.get('/timesheets', requireWorkspace as any, asyncHandler(ppmController.getTimesheet));
router.post('/timesheets/:timesheetId/logs', requireWorkspace as any, validate(logTimeBodySchema), asyncHandler(ppmController.logTime));

// === TASK ASSIGNMENTS & DEPENDENCIES ===
router.post('/tasks/:taskId/assignments', requireWorkspace as any, validate(assignTaskBodySchema), asyncHandler(ppmController.assignTask));
router.post('/tasks/dependencies', requireWorkspace as any, validate(addDependencyBodySchema), asyncHandler(ppmController.addDependency));

export const ppmRoutes = router;
