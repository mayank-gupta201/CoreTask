import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { db } from '../db';
import { portfolios, programs, programProjects, projects, timeLogs, timesheets, userCostRates, taskAssignments, taskDependencies } from '../db/schema';

export class PpmService {
    // === PORTFOLIOS & PROGRAMS ===
    async createProgram(portfolioId: string, name: string, description?: string, startDate?: Date, endDate?: Date) {
        const [program] = await db.insert(programs).values({
            portfolioId,
            name,
            description,
            startDate: startDate || null,
            endDate: endDate || null
        }).returning();
        return program;
    }

    async getPrograms(portfolioId: string) {
        return await db.query.programs.findMany({
            where: eq(programs.portfolioId, portfolioId),
            with: {
                programProjects: {
                    with: {
                        workspace: true
                    }
                }
            }
        });
    }

    // === TIMESHEETS & TIME LOGGING ===
    async getOrCreateTimesheet(userId: string, workspaceId: string, weekStart: string, weekEnd: string) {
        // weekStart / weekEnd should be YYYY-MM-DD strings
        const existing = await db.query.timesheets.findFirst({
            where: and(
                eq(timesheets.userId, userId),
                eq(timesheets.workspaceId, workspaceId),
                eq(timesheets.weekStart, weekStart)
            ),
            with: { timeLogs: true }
        });

        if (existing) return existing;

        const [newTimesheet] = await db.insert(timesheets).values({
            userId,
            workspaceId,
            weekStart,
            weekEnd,
            status: 'DRAFT'
        }).returning();
        
        return { ...newTimesheet, timeLogs: [] };
    }

    async logTime(timesheetId: string, taskId: string | null, userId: string, logDate: string, hours: number, notes?: string) {
        const [log] = await db.insert(timeLogs).values({
            timesheetId,
            taskId,
            userId,
            logDate,
            hours: hours.toString(), // Decimal mapped to string internally for compat
            notes
        }).returning();
        return log;
    }

    // === TASK ASSIGNMENTS & DEPENDENCIES ===
    async assignUserToTask(taskId: string, userId: string, assignedBy: string, allocationPercent: number = 100) {
        return await db.insert(taskAssignments).values({
            taskId,
            userId,
            assignedBy,
            allocationPercent
        }).returning();
    }

    async addTaskDependency(predecessorId: string, successorId: string, type: string, lagDays: number, createdBy: string) {
        return await db.insert(taskDependencies).values({
            predecessorTaskId: predecessorId,
            successorTaskId: successorId,
            dependencyType: type, // FS, SS, FF, SF
            lagDays,
            createdBy
        }).returning();
    }

    // === FINANCIALS ===
    async getPortfolioFinancials(portfolioId: string) {
        // Mocked aggregation replacing complex dynamic rate JOIN logic for now, giving structural insight
        // In full impl, this would join timeLogs over userCostRates grouped by effectiveDate
        return {
            margin: 18.5,
            totalCost: 22000,
            totalRevenue: 34500,
            openRisks: 8,
            currency: 'USD'
        };
    }
}

export const ppmService = new PpmService();
