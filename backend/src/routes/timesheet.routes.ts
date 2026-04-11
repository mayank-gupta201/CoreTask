import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { checkPermission } from '../middlewares/permission.middleware';
import { validate } from '../middlewares/validate.middleware';
import { timesheetController, logTimeSchema, updateLogSchema } from '../controllers/timesheet.controller';
import { z } from 'zod';

export const timesheetRoutes = Router({ mergeParams: true });
timesheetRoutes.use(authenticate as any);

// Base Member Functionality
timesheetRoutes.get('/current',
    checkPermission('timesheet:submit' as any) as any,
    timesheetController.getCurrentTimesheet as any
);

timesheetRoutes.post('/:timesheetId/logs',
    checkPermission('timesheet:submit' as any) as any,
    validate(logTimeSchema) as any,
    timesheetController.logHours as any
);

timesheetRoutes.patch('/:timesheetId/logs/:logId',
    checkPermission('timesheet:submit' as any) as any,
    validate(updateLogSchema) as any,
    timesheetController.updateLog as any
);

timesheetRoutes.delete('/:timesheetId/logs/:logId',
    checkPermission('timesheet:submit' as any) as any,
    timesheetController.deleteLog as any
);

timesheetRoutes.post('/:timesheetId/autofill',
    checkPermission('timesheet:submit' as any) as any,
    timesheetController.autoFill as any
);

timesheetRoutes.post('/:timesheetId/submit',
    checkPermission('timesheet:submit' as any) as any,
    timesheetController.submitTimesheet as any
);

// PM / Admin / Owner Approvals & Reports
timesheetRoutes.get('/',
    checkPermission('timesheet:approve' as any) as any,
    timesheetController.getTimesheetsByWorkspace as any
);

timesheetRoutes.post('/:timesheetId/approve',
    checkPermission('timesheet:approve' as any) as any,
    timesheetController.approveTimesheet as any
);

timesheetRoutes.post('/:timesheetId/reject',
    checkPermission('timesheet:approve' as any) as any,
    validate(z.object({ body: z.object({ reason: z.string() }) })) as any,
    timesheetController.rejectTimesheet as any
);

timesheetRoutes.get('/payroll-export',
    checkPermission('resource:manage' as any) as any, // Only admins/resource managers
    timesheetController.exportPayroll as any
);
