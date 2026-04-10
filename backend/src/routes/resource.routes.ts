import { Router } from 'express';
import { resourceController, assignTaskSchema, resourceGridParamsSchema, availabilitySchema, holidaySchema, costRateSchema } from '../controllers/resource.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';
import { checkPermission } from '../middlewares/permission.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router({ mergeParams: true });
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => Promise.resolve(fn(req, res, next)).catch(next);

// Must run after authenticating and establishing workspace bounds
router.use(authenticate as any);
router.use(requireWorkspace as any);

// Assignment Logic (Requires task:assign)
router.post(
    '/tasks/:taskId/assignments',
    checkPermission('task:assign') as any,
    validate(assignTaskSchema),
    asyncHandler(resourceController.assignTask)
);

router.delete(
    '/tasks/:taskId/assignments/:userId',
    checkPermission('task:assign') as any,
    asyncHandler(resourceController.removeAssignment)
);

// Resource Grid (Requires resource:read)
router.get(
    '/resources',
    checkPermission('resource:read') as any,
    validate(resourceGridParamsSchema),
    asyncHandler(resourceController.getResourceGrid)
);

// Availability & Cost Rates (Requires resource:manage)
router.put(
    '/resources/:userId/availability',
    checkPermission('resource:manage') as any,
    validate(availabilitySchema),
    asyncHandler(resourceController.setAvailability)
);

router.put(
    '/resources/:userId/cost-rate',
    checkPermission('resource:manage') as any,
    validate(costRateSchema),
    asyncHandler(resourceController.setCostRate)
);

// Holidays (Read requires resource:read, Mutations require resource:manage)
router.get(
    '/holidays',
    checkPermission('resource:read') as any,
    asyncHandler(resourceController.getHolidays)
);

router.post(
    '/holidays',
    checkPermission('resource:manage') as any,
    validate(holidaySchema),
    asyncHandler(resourceController.createHoliday)
);

router.delete(
    '/holidays/:holidayId',
    checkPermission('resource:manage') as any,
    asyncHandler(resourceController.deleteHoliday)
);

export const resourceRoutes = router;
