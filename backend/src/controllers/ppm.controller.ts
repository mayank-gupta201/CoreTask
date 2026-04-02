import { Request, Response } from 'express';
import { ppmService } from '../services/ppm.service';
import { AuthRequest } from '../middlewares/auth.middleware';

export class PpmController {
    // === PORTFOLIOS & PROGRAMS ===
    async createProgram(req: AuthRequest, res: Response) {
        try {
            const { portfolioId, name, description, startDate, endDate } = req.body;
            const program = await ppmService.createProgram(portfolioId, name, description, startDate ? new Date(startDate) : undefined, endDate ? new Date(endDate) : undefined);
            res.status(201).json(program);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async getPrograms(req: AuthRequest, res: Response) {
        try {
            const { portfolioId } = req.params;
            const programs = await ppmService.getPrograms(portfolioId as string);
            res.json(programs);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    // === SCHEMA MANGEMENT ===
    async getTimesheet(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const workspaceId = req.headers['x-workspace-id'] as string;
            const { weekStart, weekEnd } = req.query;

            if (!workspaceId) {
                return res.status(400).json({ message: 'x-workspace-id header is required' });
            }

            const StringWorkspaceId = workspaceId as string;
            const StringWeekStart = weekStart as string;
            const StringWeekEnd = weekEnd as string;

            const timesheet = await ppmService.getOrCreateTimesheet(
                userId, 
                StringWorkspaceId, 
                StringWeekStart, 
                StringWeekEnd
            );
            res.json(timesheet);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async logTime(req: AuthRequest, res: Response) {
        try {
            const userId = req.user!.userId;
            const { timesheetId } = req.params;
            const { taskId, logDate, hours, notes } = req.body;

            const log = await ppmService.logTime(timesheetId as string, taskId || null, userId, logDate, hours, notes);
            res.status(201).json(log);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    // === TASK ASSIGNMENTS & DEPENDENCIES ===
    async assignTask(req: AuthRequest, res: Response) {
        try {
            const assignedBy = req.user!.userId;
            const { taskId } = req.params;
            const { userId, allocationPercent } = req.body;

            const assignment = await ppmService.assignUserToTask(taskId as string, userId, assignedBy, allocationPercent);
            res.status(201).json(assignment);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    async addDependency(req: AuthRequest, res: Response) {
        try {
            const createdBy = req.user!.userId;
            const { predecessorId, successorId, type, lagDays } = req.body;

            const dependency = await ppmService.addTaskDependency(predecessorId, successorId, type, lagDays || 0, createdBy);
            res.status(201).json(dependency);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }

    // === FINANCIALS ===
    async getFinancials(req: AuthRequest, res: Response) {
        try {
            const { portfolioId } = req.params;
            const financials = await ppmService.getPortfolioFinancials(portfolioId as string);
            res.json(financials);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const ppmController = new PpmController();
