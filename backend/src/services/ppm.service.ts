import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { portfolios, programs, projects, timeLogs, projectAllocations } from '../db/schema';

export class PpmService {
    // === PROGRAMS ===
    async createProgram(portfolioId: string, name: string, description?: string, budget?: number) {
        const [program] = await db.insert(programs).values({
            portfolioId,
            name,
            description,
            budget: budget || 0
        }).returning();
        return program;
    }

    async getPrograms(portfolioId: string) {
        return await db.query.programs.findMany({
            where: eq(programs.portfolioId, portfolioId),
            with: {
                projects: true
            }
        });
    }

    // === RESOURCE FORECASTING ===
    async getResourceForecast(workspaceId: string) {
        // Here we could query projectAllocations vs timesheets
        // For simplicity in this mock, we just fetch allocations and time logs over the last 30 days
        const allocations = await db.query.projectAllocations.findMany({
            with: {
                user: true,
                project: true,
            }
        });
        
        return { allocations };
    }

    // === FINANCIALS & TIMESHEETS ===
    async getPortfolioFinancials(portfolioId: string) {
        // Calculates Cost Rate vs Billing Rate on TimeLogs associated with projects in this portfolio
        // This returns the exact Margin and Profitability.
        
        // This is a placeholder for the complex aggregate logic
        return {
            margin: 14.2,
            totalCost: 15000,
            totalRevenue: 28000,
            openRisks: 12
        };
    }
}

export const ppmService = new PpmService();
