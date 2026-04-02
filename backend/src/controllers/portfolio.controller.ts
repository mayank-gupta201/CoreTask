import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { portfolioService } from '../services/portfolio.service';
import { z } from 'zod';

export const createPortfolioSchema = z.object({
    body: z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional()
    }),
});

export class PortfolioController {
    async createPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const { workspaceId, name, description } = req.body;
            const portfolio = await portfolioService.createPortfolio(workspaceId, userId, name, description);
            return res.status(201).json(portfolio);
        } catch (error) {
            next(error);
        }
    }

    async getPortfolios(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.query.workspaceId as string;
            if (!workspaceId) throw new Error("workspaceId query parameter is required");
            const portfolios = await portfolioService.getPortfolios(workspaceId);
            return res.json(portfolios);
        } catch (error) {
            next(error);
        }
    }
}

export const portfolioController = new PortfolioController();
