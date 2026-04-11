import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { dashboardService } from '../services/dashboard.service';

export class DashboardController {
    async getProjectDashboard(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const data = await dashboardService.getProjectDashboard(workspaceId);
            return res.json(data);
        } catch (error) {
            next(error);
        }
    }

    async getPersonalDashboard(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.params.workspaceId as string;
            const userId = req.user!.userId;
            const data = await dashboardService.getPersonalDashboard(userId, workspaceId);
            return res.json(data);
        } catch (error) {
            next(error);
        }
    }
}

export const dashboardController = new DashboardController();
