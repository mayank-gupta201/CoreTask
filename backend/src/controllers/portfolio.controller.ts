import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { portfolioService } from '../services/portfolio.service';
import { z } from 'zod';

export const createPortfolioSchema = z.object({
    body: z.object({
        workspaceId: z.string().uuid(),
        name: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional()
    }),
});

export const updatePortfolioSchema = z.object({
    body: z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        status: z.enum(['ACTIVE', 'ARCHIVED']).optional()
    }),
});

export const createProgramSchema = z.object({
    body: z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
    }),
});

export const addProjectToProgramSchema = z.object({
    body: z.object({
        workspaceId: z.string().uuid()
    }),
});

export class PortfolioController {
    
    // -- Portfolios --

    async createPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const { workspaceId, name, description, color } = req.body;
            const portfolio = await portfolioService.createPortfolio(workspaceId, userId, name, description, color);
            return res.status(201).json(portfolio);
        } catch (error) {
            next(error);
        }
    }

    async getPortfolios(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const workspaceId = req.query.workspaceId as string;
            if (!workspaceId) return res.status(400).json({ message: "workspaceId query parameter is required" });
            const portfolios = await portfolioService.getPortfolios(workspaceId, userId);
            return res.json(portfolios);
        } catch (error) {
            next(error);
        }
    }

    async getPortfolio(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const portfolio = await portfolioService.getPortfolioById(req.params.id as string, userId);
            return res.json(portfolio);
        } catch (error) {
            next(error);
        }
    }

    async updatePortfolio(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const portfolio = await portfolioService.updatePortfolio(req.params.id as string, userId, req.body);
            return res.json(portfolio);
        } catch (error) {
            next(error);
        }
    }

    async deletePortfolio(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            await portfolioService.deletePortfolio(req.params.id as string, userId);
            return res.status(204).send();
        } catch (error) {
            next(error);
        }
    }

    async getPortfolioDashboard(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const dashboardData = await portfolioService.getPortfolioDashboard(req.params.id as string, userId);
            return res.json(dashboardData);
        } catch (error) {
            next(error);
        }
    }

    async getPortfolioRoadmap(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            // Wait, import the getPortfolioRoadmapData from where we defined it
            const { getPortfolioRoadmapData } = require('../repositories/portfolioRoadmap');
            const data = await getPortfolioRoadmapData(req.params.id as string);
            return res.json(data);
        } catch (error) {
            next(error);
        }
    }

    // -- Programs --

    async createProgram(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const data = {
                ...req.body,
                startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
                endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
            };
            const program = await portfolioService.createProgram(req.params.id as string, userId, data);
            return res.status(201).json(program);
        } catch (error) {
            next(error);
        }
    }

    async getPrograms(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const programs = await portfolioService.getProgramsByPortfolio(req.params.id as string, userId);
            return res.json(programs);
        } catch (error) {
            next(error);
        }
    }

    // -- Program Projects --

    async addProjectToProgram(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const { workspaceId } = req.body;
            const added = await portfolioService.addProjectToProgram(
                req.params.id as string,      // portfolioId
                req.params.programId as string, // programId
                workspaceId,        // project
                userId
            );
            return res.status(201).json(added);
        } catch (error) {
            next(error);
        }
    }

    async removeProjectFromProgram(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            await portfolioService.removeProjectFromProgram(
                req.params.id as string,      // portfolioId
                req.params.programId as string, // programId
                req.params.workspaceId as string,
                userId
            );
            return res.status(204).send();
        } catch (error) {
            next(error);
        }
    }
}

export const portfolioController = new PortfolioController();
