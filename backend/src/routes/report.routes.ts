import { Router } from 'express';
import { reportController, generateReportSchema, createTemplateSchema } from '../controllers/report.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { checkPermission } from '../middlewares/permission.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router({ mergeParams: true });
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

router.use(authenticate as any);
router.use(requireWorkspace as any);

// POST /api/workspaces/:workspaceId/reports/generate
router.post(
    '/generate',
    checkPermission('report:generate') as any,
    validate(generateReportSchema),
    asyncHandler(reportController.generateReport)
);

// GET /api/workspaces/:workspaceId/reports/status/:jobId
router.get(
    '/status/:jobId',
    checkPermission('report:generate') as any,
    asyncHandler(reportController.getJobStatus)
);

// GET /api/workspaces/:workspaceId/reports
router.get(
    '/',
    checkPermission('report:generate') as any,
    asyncHandler(reportController.getGeneratedReports)
);

// GET /api/workspaces/:workspaceId/report-templates
router.get(
    '/templates',
    checkPermission('report:generate') as any,
    asyncHandler(reportController.getReportTemplates)
);

// POST /api/workspaces/:workspaceId/report-templates
router.post(
    '/templates',
    checkPermission('report:manage') as any,
    validate(createTemplateSchema),
    asyncHandler(reportController.createReportTemplate)
);

// DELETE /api/workspaces/:workspaceId/report-templates/:id
router.delete(
    '/templates/:id',
    checkPermission('report:manage') as any,
    asyncHandler(reportController.deleteReportTemplate)
);

export const reportRoutes = router;
