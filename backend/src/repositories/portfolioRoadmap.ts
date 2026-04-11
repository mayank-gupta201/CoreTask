import { eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { portfolios, tasks, milestones as tblMilestones } from '../db/schema';
import { ProblemDetails } from '../errors';
import { portfolioRepository } from './portfolio.repository';

export const getPortfolioRoadmapData = async (portfolioId: string) => {
    const portfolio = await portfolioRepository.getPortfolioById(portfolioId);
    if (!portfolio) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Portfolio not found' });

    const workspaceIds: string[] = [];
    portfolio.programs.forEach(prog => {
        prog.programProjects.forEach(pp => {
            if (!workspaceIds.includes(pp.workspaceId)) {
                workspaceIds.push(pp.workspaceId);
            }
        });
    });

    if (workspaceIds.length === 0) return { projects: [], milestones: [] };

    // Get min/max dates per workspace
    const projectSpans = await db.execute(sql`
        SELECT 
            workspace_id as "workspaceId",
            MIN(start_date) as "earliestStart",
            MAX(due_date) as "latestEnd"
        FROM tasks
        WHERE workspace_id = ANY(${workspaceIds})
        GROUP BY workspace_id
    `);

    // Get milestones
    const milestones = await db.query.milestones.findMany({
        where: workspaceIds.length ? sql`workspace_id IN (${sql.join(workspaceIds.map(id => sql`${id}`), sql`, `)})` : sql`workspace_id = '00000000-0000-0000-0000-000000000000'`
    });

    const projectsData = workspaceIds.map(wid => {
        let name = 'Unknown';
        portfolio.programs.forEach(prog => {
            const pp = prog.programProjects.find(p => p.workspaceId === wid);
            if (pp && pp.workspace) name = pp.workspace.name;
        });

        const span: any = projectSpans.rows.find((r: any) => r.workspaceId === wid);
        // Default span if no tasks found
        const start = span?.earliestStart ? new Date(span.earliestStart) : new Date();
        const end = span?.latestEnd ? new Date(span.latestEnd) : new Date(new Date().setMonth(new Date().getMonth() + 1));

        return {
            id: wid,
            name,
            start,
            end,
            type: 'project',
            progress: 50 // Mock progress for visual
        };
    });

    return {
        projects: projectsData,
        milestones: milestones.map(m => ({
            id: m.id,
            name: m.title,
            start: m.dueDate,
            end: m.dueDate,
            type: 'milestone',
            project: m.workspaceId, // link to project bar
            isComplete: m.isComplete
        }))
    };
};
