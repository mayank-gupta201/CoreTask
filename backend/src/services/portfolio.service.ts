import { portfolioRepository } from '../repositories/portfolio.repository';
import { redisClient } from './cache.service';
import { db } from '../db';
import { workspaceMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ProblemDetails } from '../errors';

export class PortfolioService {

    async createPortfolio(workspaceId: string, ownerId: string, name: string, description?: string, color?: string) {
        // Verify user is at least an admin in the workspace they are binding this to
        const member = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, ownerId))
        });
        
        if (!member || member.role === 'MEMBER' || member.role === 'VIEWER') {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only Admins or Owners can create Portfolios.' });
        }

        return await portfolioRepository.createPortfolio({
            workspaceId,
            ownerId,
            name,
            description,
            color
        });
    }

    async getPortfolios(workspaceId: string, userId: string) {
        // In this architecture, we filter globally by workspaceId the user is querying
        // But double check they belong to the workspace
        const member = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
        });

        if (!member) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Unauthorized to view portfolios for this workspace.' });
        }

        return await portfolioRepository.getPortfoliosByUser(userId, workspaceId);
    }

    async getPortfolioById(id: string, userId: string) {
        const portfolio = await portfolioRepository.getPortfolioById(id);
        // Authorization: Validate user access
        const member = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, portfolio.workspaceId), eq(workspaceMembers.userId, userId))
        });

        if (!member) throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Unauthorized access to portfolio.' });

        return portfolio;
    }

    async updatePortfolio(id: string, userId: string, data: any) {
        const portfolio = await this.getPortfolioById(id, userId);
        
        // Ensure user is owner of the portfolio
        if (portfolio.ownerId !== userId) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only the portfolio owner can update it.' });
        }

        return await portfolioRepository.updatePortfolio(id, data);
    }

    async deletePortfolio(id: string, userId: string) {
        const portfolio = await this.getPortfolioById(id, userId);
        
        if (portfolio.ownerId !== userId) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only the portfolio owner can delete it.' });
        }

        return await portfolioRepository.deletePortfolio(id);
    }

    async getPortfolioDashboard(id: string, userId: string) {
        // Auth check
        await this.getPortfolioById(id, userId);

        const cacheKey = `portfolio_dashboard:${id}`;

        if (redisClient) {
            const cached = await redisClient.get(cacheKey);
            if (cached) {
                return JSON.parse(cached);
            }
        }

        const data = await portfolioRepository.getPortfolioDashboard(id);

        if (redisClient && data) {
            // Cache for 300 seconds (5 minutes)
            await redisClient.setex(cacheKey, 300, JSON.stringify(data));
        }

        return data;
    }

    // --- Programs & Projects Management ---

    async createProgram(portfolioId: string, userId: string, data: { name: string, description?: string, startDate?: Date, endDate?: Date }) {
        const portfolio = await this.getPortfolioById(portfolioId, userId);
        if (portfolio.ownerId !== userId) throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only the portfolio owner can create programs.' });

        return await portfolioRepository.createProgram({ ...data, portfolioId });
    }

    async getProgramsByPortfolio(portfolioId: string, userId: string) {
        await this.getPortfolioById(portfolioId, userId); // check auth
        return await portfolioRepository.getProgramsByPortfolio(portfolioId);
    }

    async addProjectToProgram(portfolioId: string, programId: string, workspaceId: string, userId: string) {
        // 1. Verify user is OWNER of the portfolio
        const portfolio = await this.getPortfolioById(portfolioId, userId);
        if (portfolio.ownerId !== userId) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only the portfolio owner can add projects to programs.' });
        }

        // 2. Verify user is also OWNER/ADMIN of the workspace being added
        const targetWorkspaceMember = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId))
        });

        if (!targetWorkspaceMember || (targetWorkspaceMember.role !== 'OWNER' && targetWorkspaceMember.role !== 'ADMIN')) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'You must be an Admin or Owner of the project (workspace) to add it to a program.' });
        }

        return await portfolioRepository.addProjectToProgram(programId, workspaceId);
    }

    async removeProjectFromProgram(portfolioId: string, programId: string, workspaceId: string, userId: string) {
        const portfolio = await this.getPortfolioById(portfolioId, userId);
        if (portfolio.ownerId !== userId) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Only the portfolio owner can remove projects from programs.' });
        }
        
        await portfolioRepository.removeProjectFromProgram(programId, workspaceId);
    }
}

export const portfolioService = new PortfolioService();
