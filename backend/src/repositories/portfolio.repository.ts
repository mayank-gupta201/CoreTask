import { eq, and, sql, or } from 'drizzle-orm';
import { db } from '../db';
import { portfolios, programs, programProjects, workspaces, 
    workspaceMembers, tasks, milestones as tblMilestones, projectMilestones, timeLogs, projectExpenses, users 
} from '../db/schema';
import { ProblemDetails } from '../errors';

export class PortfolioRepository {
    async createPortfolio(data: { workspaceId: string, ownerId: string, name: string, description?: string, color?: string }) {
        const [portfolio] = await db.insert(portfolios).values(data).returning();
        return portfolio;
    }

    async getPortfoliosByUser(userId: string, workspaceId: string) {
        // Find portfolios the user has access to - typically through workspace membership
        // But for isolation we stick to ownerId or matching workspace
        return await db.query.portfolios.findMany({
            where: and(
                eq(portfolios.workspaceId, workspaceId),
                eq(portfolios.status, 'ACTIVE')
            ),
            with: {
                programs: {
                    with: {
                        programProjects: {
                            with: {
                                workspace: true
                            }
                        }
                    }
                }
            }
        });
    }

    async getPortfolioById(id: string) {
        const portfolio = await db.query.portfolios.findFirst({
            where: eq(portfolios.id, id),
            with: {
                programs: {
                    with: {
                        programProjects: {
                            with: {
                                workspace: true
                            }
                        }
                    }
                }
            }
        });
        if (!portfolio) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Portfolio not found' });
        return portfolio;
    }

    async updatePortfolio(id: string, data: Partial<typeof portfolios.$inferInsert>) {
        const [updated] = await db.update(portfolios)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(portfolios.id, id))
            .returning();
        
        if (!updated) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Portfolio not found' });
        return updated;
    }

    async deletePortfolio(id: string) {
        const [deleted] = await db.delete(portfolios)
            .where(eq(portfolios.id, id))
            .returning();
            
        if (!deleted) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Portfolio not found' });
        return deleted;
    }

    async createProgram(data: { portfolioId: string, name: string, description?: string, startDate?: Date, endDate?: Date }) {
        const [program] = await db.insert(programs).values(data).returning();
        return program;
    }

    async getProgramsByPortfolio(portfolioId: string) {
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

    async addProjectToProgram(programId: string, workspaceId: string) {
        const [added] = await db.insert(programProjects).values({
            programId,
            workspaceId
        }).onConflictDoNothing().returning();
        return added;
    }

    async removeProjectFromProgram(programId: string, workspaceId: string) {
        await db.delete(programProjects)
            .where(and(
                eq(programProjects.programId, programId),
                eq(programProjects.workspaceId, workspaceId)
            ));
    }

    async getPortfolioDashboard(portfolioId: string) {
        // Fetch base portfolio
        const portfolio = await this.getPortfolioById(portfolioId);

        // Gather all workspace IDs in this portfolio
        const workspaceIds: string[] = [];
        portfolio.programs.forEach(prog => {
            prog.programProjects.forEach(pp => {
                if (!workspaceIds.includes(pp.workspaceId)) {
                    workspaceIds.push(pp.workspaceId);
                }
            });
        });

        const dashboardData = {
            portfolio: {
                id: portfolio.id,
                name: portfolio.name,
                color: portfolio.color,
                status: portfolio.status
            },
            totalProjects: workspaceIds.length,
            totalTasks: 0,
            completedTasks: 0,
            overallCompletionPercent: 0,
            projectHealth: [] as any[],
            upcomingMilestones: [] as any[],
            totalBudget: 0,
            spentBudget: 0
        };

        if (workspaceIds.length === 0) return dashboardData;

        // Perform parallel queries for performance
        const [
            allTasks,
            allMilestones,
            allUsers,
            allTimeLogs
        ] = await Promise.all([
            // Tasks per workspace
            db.query.tasks.findMany({
                where: sql`${tasks.workspaceId} IN ${workspaceIds.length ? workspaceIds : ['00000000-0000-0000-0000-000000000000']}`
            }),
            // Milestones (using projectMilestones which lacks workspace string relation unless we map through projects)
            // But wait, the schema doesn't have workspaceId on projectMilestones directly, only on abstract milestones
            // Let's use the core `milestones` table which DOES have `workspaceId`.
            db.query.milestones.findMany({
                where: workspaceIds.length ? sql`workspace_id IN (${sql.join(workspaceIds.map(id => sql`${id}`), sql`, `)})` : sql`workspace_id = '00000000-0000-0000-0000-000000000000'`,
                orderBy: (m, { asc }) => [asc(m.dueDate)],
                limit: 20
            }),
            // Need users mapping to get rates for workspace members
            db.query.workspaceMembers.findMany({
                where: sql`${workspaceMembers.workspaceId} IN ${workspaceIds.length ? workspaceIds : ['00000000-0000-0000-0000-000000000000']}`
            }),
            // Get timelogs via tasks that belong to these workspaces
            db.execute(sql`
                SELECT tl.hours, tl.user_id as "userId", t.workspace_id as "workspaceId"
                FROM time_logs tl
                JOIN tasks t ON tl.task_id = t.id
                WHERE t.workspace_id = ANY(${workspaceIds})
            `)
        ]);

        dashboardData.totalTasks = allTasks.length;
        dashboardData.completedTasks = allTasks.filter(t => t.status === 'DONE').length;
        dashboardData.overallCompletionPercent = dashboardData.totalTasks > 0 
            ? Math.round((dashboardData.completedTasks / dashboardData.totalTasks) * 100) 
            : 0;

        // Calculate Project Health & Budget
        for (const wid of workspaceIds) {
            const wTasks = allTasks.filter(t => t.workspaceId === wid);
            const wTotal = wTasks.length;
            const wCompleted = wTasks.filter(t => t.status === 'DONE').length;
            const completionPercent = wTotal > 0 ? Math.round((wCompleted / wTotal) * 100) : 0;
            
            const now = new Date();
            const overdueTasks = wTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
            
            let health = 'ON_TRACK';
            if (completionPercent < 30) {
                health = 'OFF_TRACK';
            } else if (overdueTasks > 0) {
                health = 'AT_RISK';
            }

            // Estimate Budget based on Task estimated_hours. Since Drizzle decimals come back as strings, parse.
            const wBudgetMap = wTasks.reduce((acc, t) => acc + (parseFloat(t.estimatedHours as any) || 0) * 50, 0); // Mock cost default 50 if rate unknown

            const wTimeLogs = allTimeLogs.rows.filter((row: any) => row.workspaceId === wid);
            const wSpent = wTimeLogs.reduce((acc, row: any) => acc + (parseFloat(row.hours as any) || 0) * 50, 0);

            dashboardData.totalBudget += wBudgetMap;
            dashboardData.spentBudget += wSpent;

            // Find Workspace name
            let workspaceName = 'Unknown Workspace';
            portfolio.programs.forEach(prog => {
                const pp = prog.programProjects.find(p => p.workspaceId === wid);
                if (pp && pp.workspace) {
                    workspaceName = pp.workspace.name;
                }
            });

            dashboardData.projectHealth.push({
                workspaceId: wid,
                workspaceName,
                totalTasks: wTotal,
                completedTasks: wCompleted,
                completionPercent,
                overdueTasks,
                health
            });
        }

        // Upcoming Milestones
        dashboardData.upcomingMilestones = allMilestones
            .filter(m => !m.isComplete)
            .slice(0, 5)
            .map(m => {
                let wName = 'Unknown';
                portfolio.programs.forEach(prog => {
                    const pp = prog.programProjects.find(p => p.workspaceId === m.workspaceId);
                    if (pp && pp.workspace) wName = pp.workspace.name;
                });
                return {
                    title: m.title,
                    dueDate: m.dueDate,
                    workspaceName: wName,
                    isComplete: m.isComplete
                };
            });

        return dashboardData;
    }
}

export const portfolioRepository = new PortfolioRepository();
