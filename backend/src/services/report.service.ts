import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import { db } from '../db';
import { 
    tasks, timeLogs, timesheets, taskAssignments, 
    userCostRates, workspaceMembers, users, 
    generatedReports, reportTemplates, reportSchedules 
} from '../db/schema';

export class ReportService {

    /**
     * STATUS REPORT — workspace task overview with completion trend and blockers
     */
    async getStatusReportData(workspaceId: string, dateFrom?: string, dateTo?: string) {
        const allTasks = await db.query.tasks.findMany({ 
            where: eq(tasks.workspaceId, workspaceId) 
        });

        const now = new Date();
        const total = allTasks.length;
        const todo = allTasks.filter(t => t.status === 'TODO').length;
        const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
        const done = allTasks.filter(t => t.status === 'DONE').length;
        const overdue = allTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;

        const members = await db.query.workspaceMembers.findMany({
            where: eq(workspaceMembers.workspaceId, workspaceId)
        });

        // Completion trend — last 8 weeks
        const completionTrend = [];
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setHours(0, 0, 0, 0);
        startOfThisWeek.setDate(now.getDate() - now.getDay());

        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(startOfThisWeek);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
            const completed = allTasks.filter(
                t => t.status === 'DONE' && t.updatedAt >= weekStart && t.updatedAt < weekEnd
            ).length;
            completionTrend.push({ week: weekLabel, completed });
        }

        // Top blockers — IN_PROGRESS tasks past due
        const topBlockers = allTasks
            .filter(t => t.status === 'IN_PROGRESS' && t.dueDate && new Date(t.dueDate) < now)
            .map(t => ({
                taskTitle: t.title,
                daysSinceCreated: Math.ceil((now.getTime() - t.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
                assignee: t.assignedTo || t.userId,
            }))
            .slice(0, 10);

        // Upcoming deadlines
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const upcomingDeadlines = allTasks
            .filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= nextWeek)
            .map(t => ({
                taskTitle: t.title,
                dueDate: t.dueDate,
                assignee: t.assignedTo || t.userId,
                priority: t.priority,
            }))
            .slice(0, 10);

        return {
            workspace: { name: workspaceId, memberCount: members.length },
            taskSummary: { total, todo, inProgress, done, overdue },
            completionTrend,
            topBlockers,
            upcomingDeadlines,
        };
    }

    /**
     * TIME VARIANCE REPORT — estimated vs logged hours
     */
    async getTimeVarianceData(workspaceId: string, dateFrom: string, dateTo: string) {
        const allTasks = await db.query.tasks.findMany({
            where: eq(tasks.workspaceId, workspaceId),
        });

        // All time logs for tasks in this workspace within the date range
        const logs = await db.execute(sql`
            SELECT tl.task_id, tl.user_id, tl.hours, tl.log_date, t.title, t.estimated_hours
            FROM time_logs tl
            JOIN timesheets ts ON tl.timesheet_id = ts.id
            JOIN tasks t ON tl.task_id = t.id
            WHERE t.workspace_id = ${workspaceId}
              AND tl.log_date >= ${dateFrom}
              AND tl.log_date <= ${dateTo}
        `);

        // Aggregate by task
        const taskMap = new Map<string, { taskId: string; taskTitle: string; estimatedHours: number; loggedHours: number }>();
        const memberMap = new Map<string, { userId: string; name: string; estimatedHours: number; loggedHours: number }>();

        for (const task of allTasks) {
            taskMap.set(task.id, {
                taskId: task.id,
                taskTitle: task.title,
                estimatedHours: task.estimatedHours ? Number(task.estimatedHours) : 0,
                loggedHours: 0,
            });
        }

        for (const row of logs.rows as any[]) {
            const taskEntry = taskMap.get(row.task_id);
            if (taskEntry) {
                taskEntry.loggedHours += parseFloat(row.hours || '0');
            }

            if (!memberMap.has(row.user_id)) {
                memberMap.set(row.user_id, { userId: row.user_id, name: row.user_id, estimatedHours: 0, loggedHours: 0 });
            }
            const memberEntry = memberMap.get(row.user_id)!;
            memberEntry.loggedHours += parseFloat(row.hours || '0');
            memberEntry.estimatedHours += parseFloat(row.estimated_hours || '0');
        }

        const byTask = Array.from(taskMap.values()).map(t => ({
            ...t,
            variance: t.loggedHours - t.estimatedHours,
        }));

        const totalEstimatedHours = byTask.reduce((a, t) => a + t.estimatedHours, 0);
        const totalLoggedHours = byTask.reduce((a, t) => a + t.loggedHours, 0);

        return {
            summary: {
                totalEstimatedHours,
                totalLoggedHours,
                varianceHours: totalLoggedHours - totalEstimatedHours,
                variancePercent: totalEstimatedHours > 0 ? Math.round(((totalLoggedHours - totalEstimatedHours) / totalEstimatedHours) * 100) : 0,
            },
            byTask,
            byMember: Array.from(memberMap.values()).map(m => ({
                ...m,
                variance: m.loggedHours - m.estimatedHours,
            })),
        };
    }

    /**
     * COST REPORT — budgeted vs actual cost using hourly rates
     */
    async getCostReportData(workspaceId: string, dateFrom: string, dateTo: string) {
        const rates = await db.select().from(userCostRates).where(eq(userCostRates.workspaceId, workspaceId));
        const rateMap = new Map<string, number>();
        for (const r of rates) rateMap.set(r.userId, parseFloat(r.hourlyRate as any));

        const allTasks = await db.query.tasks.findMany({
            where: eq(tasks.workspaceId, workspaceId),
        });

        // Aggregate estimated cost (estimated_hours × rate of assigned user)
        let budgetedCost = 0;
        for (const task of allTasks) {
            const estHours = task.estimatedHours ? Number(task.estimatedHours) : 0;
            const rate = rateMap.get(task.assignedTo || task.userId) || 0;
            budgetedCost += estHours * rate;
        }

        // Actual cost = time_logs hours × rate
        const logs = await db.execute(sql`
            SELECT tl.user_id, tl.hours
            FROM time_logs tl
            JOIN timesheets ts ON tl.timesheet_id = ts.id
            WHERE ts.workspace_id = ${workspaceId}
              AND tl.log_date >= ${dateFrom}
              AND tl.log_date <= ${dateTo}
        `);

        let actualCost = 0;
        const memberCostMap = new Map<string, { name: string; hourlyRate: number; hoursLogged: number; cost: number }>();

        for (const row of logs.rows as any[]) {
            const rate = rateMap.get(row.user_id) || 0;
            const hours = parseFloat(row.hours || '0');
            const cost = hours * rate;
            actualCost += cost;

            if (!memberCostMap.has(row.user_id)) {
                memberCostMap.set(row.user_id, { name: row.user_id, hourlyRate: rate, hoursLogged: 0, cost: 0 });
            }
            const entry = memberCostMap.get(row.user_id)!;
            entry.hoursLogged += hours;
            entry.cost += cost;
        }

        const cpi = actualCost > 0 ? budgetedCost / actualCost : 0;

        return {
            summary: { budgetedCost, actualCost, variance: budgetedCost - actualCost, cpi: Math.round(cpi * 100) / 100 },
            byProject: [{ workspaceName: workspaceId, budgeted: budgetedCost, actual: actualCost }],
            byMember: Array.from(memberCostMap.values()),
        };
    }

    /**
     * RESOURCE AVAILABILITY REPORT — reuses resource grid data
     */
    async getResourceAvailabilityData(workspaceId: string, dateFrom: string, dateTo: string) {
        // Delegate to resource repository / service
        const { resourceRepository } = await import('../repositories/resource.repository');
        return await resourceRepository.getResourceGridData(workspaceId, new Date(dateFrom), new Date(dateTo));
    }

    /**
     * TIMESHEET REPORT — hours per user per task
     */
    async getTimesheetReportData(workspaceId: string, dateFrom: string, dateTo: string, userId?: string) {
        const conditions = [
            eq(timesheets.workspaceId, workspaceId),
            gte(timesheets.weekStart, dateFrom as any),
            lte(timesheets.weekEnd, dateTo as any),
        ];

        const allTimesheets = await db.query.timesheets.findMany({
            where: and(...conditions),
            with: { user: true, timeLogs: { with: { task: true } } },
        });

        const rows = allTimesheets
            .filter(ts => !userId || ts.userId === userId)
            .map(ts => {
                const totalHours = ts.timeLogs.reduce((acc: number, l: any) => acc + parseFloat(l.hours || '0'), 0);
                const taskBreakdown = ts.timeLogs.map((l: any) => ({
                    taskTitle: l.task?.title || 'Unassigned',
                    hours: parseFloat(l.hours || '0'),
                }));
                return {
                    userName: ts.user?.email || 'Unknown',
                    weekStart: ts.weekStart,
                    totalHours,
                    status: ts.status,
                    taskBreakdown,
                };
            });

        return { rows };
    }

    /**
     * REPORT TEMPLATES — CRUD
     */
    async getReportTemplates(workspaceId: string) {
        return await db.query.reportTemplates.findMany({
            where: eq(reportTemplates.workspaceId, workspaceId),
            orderBy: desc(reportTemplates.createdAt),
        });
    }

    async createReportTemplate(workspaceId: string, userId: string, data: { name: string; reportType: string; config: any }) {
        const [template] = await db.insert(reportTemplates).values({
            workspaceId,
            name: data.name,
            reportType: data.reportType,
            config: data.config,
            createdBy: userId,
        }).returning();
        return template;
    }

    async deleteReportTemplate(id: string, workspaceId: string) {
        const [deleted] = await db.delete(reportTemplates)
            .where(and(eq(reportTemplates.id, id), eq(reportTemplates.workspaceId, workspaceId)))
            .returning();
        return deleted;
    }

    /**
     * GENERATED REPORTS — listing
     */
    async getGeneratedReports(workspaceId: string) {
        // Join with report_templates to filter by workspace
        return await db.execute(sql`
            SELECT gr.*, rt.name as template_name, rt.report_type
            FROM generated_reports gr
            LEFT JOIN report_templates rt ON gr.report_template_id = rt.id
            WHERE rt.workspace_id = ${workspaceId} OR gr.generated_by IN (
                SELECT user_id FROM workspace_members WHERE workspace_id = ${workspaceId}
            )
            ORDER BY gr.generated_at DESC
            LIMIT 50
        `);
    }
}

export const reportService = new ReportService();
