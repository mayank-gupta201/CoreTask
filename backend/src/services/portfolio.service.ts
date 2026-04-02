import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { portfolios, workspaceMembers } from '../db/schema';

export class PortfolioService {
    async createPortfolio(workspaceId: string, ownerId: string, name: string, description?: string) {
        const member = await db.query.workspaceMembers.findFirst({
            where: and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, ownerId))
        });
        
        if (!member || member.role === 'MEMBER') {
            throw new Error('Unauthorized: Only Admins or Owners can create Portfolios');
        }

        const [portfolio] = await db.insert(portfolios).values({
            workspaceId,
            ownerId,
            name,
            description
        }).returning();

        return portfolio;
    }

    async getPortfolios(workspaceId: string) {
        return await db.query.portfolios.findMany({
            where: eq(portfolios.workspaceId, workspaceId),
            with: {
                programs: true,
                projects: true
            }
        });
    }
}

export const portfolioService = new PortfolioService();
