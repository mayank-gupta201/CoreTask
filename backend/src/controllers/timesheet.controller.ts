import { Response } from 'express';
import { timesheetService } from '../services/timesheet.service';
import { dashboardService } from '../services/dashboard.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

export const logTimeSchema = z.object({
    body: z.object({
        taskId: z.string().uuid().optional(),
        logDate: z.string().date(),
        hours: z.number().min(0.1).max(24),
        notes: z.string().optional()
    }),
});

export const updateLogSchema = z.object({
    body: z.object({
        hours: z.number().min(0.1).max(24).optional(),
        notes: z.string().optional()
    }),
});

export class TimesheetController {
    async getCurrentTimesheet(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const weekStart = req.query.weekStart as string | undefined;

            const ts = await timesheetService.getCurrentTimesheet(userId, workspaceId, weekStart);
            res.json(ts);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async logHours(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const timesheetId = req.params.timesheetId as string;

            const log = await timesheetService.logHours(userId, workspaceId, timesheetId, req.body);
            await dashboardService.clearDashboardCache(workspaceId, userId);
            res.status(201).json(log);
        } catch (error: any) {
            if (error.status) res.status(error.status).json({ message: error.detail || error.message });
            else res.status(500).json({ message: error.message });
        }
    }

    async updateLog(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const logId = req.params.logId as string;
            const timesheetId = req.params.timesheetId as string; // Can be used for extra validation 

            // Deferring directly to repo for simple updates logic that skip complex service
            const { timesheetRepository } = require('../repositories/timesheet.repository');
            await timesheetRepository.updateTimeLog(logId, req.body);
            await dashboardService.clearDashboardCache(workspaceId, userId);
            res.status(200).json({ success: true });
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async deleteLog(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const logId = req.params.logId as string;

            const { timesheetRepository } = require('../repositories/timesheet.repository');
            await timesheetRepository.deleteTimeLog(logId, userId);
            const workspaceId = req.workspace!.id;
            await dashboardService.clearDashboardCache(workspaceId, userId);
            res.status(204).send();
        } catch (error: any) {
             if (error.status) res.status(error.status).json({ message: error.detail || error.message });
             else res.status(500).json({ message: error.message });
        }
    }

    async autoFill(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const timesheetId = req.params.timesheetId as string;

            const result = await timesheetService.autoFillFromLastWeek(userId, workspaceId, timesheetId);
            await dashboardService.clearDashboardCache(workspaceId, userId);
            res.json(result);
        } catch (error: any) {
             if (error.status) res.status(error.status).json({ message: error.detail || error.message });
             else res.status(500).json({ message: error.message });
        }
    }

    async submitTimesheet(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const timesheetId = req.params.timesheetId as string;

            const ts = await timesheetService.submitTimesheet(userId, workspaceId, timesheetId);
            res.json(ts);
        } catch (error: any) {
             if (error.status) res.status(error.status).json({ message: error.detail || error.message });
             else res.status(500).json({ message: error.message });
        }
    }

    // --- PM APPROVAL VIEWS ---
    async getTimesheetsByWorkspace(req: AuthRequest, res: Response) {
        try {
             const workspaceId = req.workspace!.id;
             const filters = {
                 userId: req.query.userId as string,
                 status: req.query.status as string,
                 weekStart: req.query.weekStart ? new Date(req.query.weekStart as string) : undefined
             };

             const { timesheetRepository } = require('../repositories/timesheet.repository');
             const data = await timesheetRepository.getTimesheetsByWorkspace(workspaceId, filters);
             res.json(data);
        } catch(error: any) {
             res.status(500).json({ message: error.message });
        }
    }

    async approveTimesheet(req: AuthRequest, res: Response) {
        try {
             const approverId = req.user!.userId;
             const workspaceId = req.workspace!.id;
             const timesheetId = req.params.timesheetId as string;

             const ts = await timesheetService.approveTimesheet(approverId, workspaceId, timesheetId);
             res.json(ts);
        } catch(error: any) {
             if (error.status) res.status(error.status).json({ message: error.detail || error.message });
             else res.status(500).json({ message: error.message });
        }
    }

    async rejectTimesheet(req: AuthRequest, res: Response) {
        try {
             const approverId = req.user!.userId;
             const workspaceId = req.workspace!.id;
             const timesheetId = req.params.timesheetId as string;
             const reason = req.body.reason || 'No reason provided';

             const ts = await timesheetService.rejectTimesheet(approverId, workspaceId, timesheetId, reason);
             res.json(ts);
        } catch(error: any) {
             if (error.status) res.status(error.status).json({ message: error.detail || error.message });
             else res.status(500).json({ message: error.message });
        }
    }

    async exportPayroll(req: AuthRequest, res: Response) {
        try {
             const workspaceId = req.workspace!.id;
             const weekStart = req.query.weekStart as string;
             const weekEnd = req.query.weekEnd as string;
             const requesterId = req.user!.userId;

             if (!weekStart || !weekEnd) {
                 return res.status(400).json({ message: 'weekStart and weekEnd are required queries' });
             }

             const csvData = await timesheetService.exportPayroll(workspaceId, weekStart, weekEnd, requesterId);

             res.setHeader('Content-Type', 'text/csv');
             res.setHeader('Content-Disposition', `attachment; filename=payroll-${weekStart}-to-${weekEnd}.csv`);
             res.status(200).send(csvData);
        } catch(error: any) {
             res.status(500).json({ message: error.message });
        }
    }
}

export const timesheetController = new TimesheetController();
