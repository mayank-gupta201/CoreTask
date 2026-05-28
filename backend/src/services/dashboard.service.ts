import { eq, sql, desc, and, inArray, gte, lt } from 'drizzle-orm';
import { db } from '../db';
import { tasks, taskActivities, timeLogs, workspaceMembers, users } from '../db/schema';
import { redisClient, CacheService, cacheService } from './cache.service';
import { logger } from '../middlewares/logger.middleware';

/** Safe Redis helper — returns true only if the client is actually connected */
function isRedisReady(): boolean {
    return redisClient.status === 'ready';
}

export class DashboardService {
    async getProjectDashboard(workspaceId: string) {
        const cacheKey = CacheService.keys.workspaceDashboard(workspaceId);
        if (isRedisReady()) {
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) return JSON.parse(cached);
            } catch { /* Redis unavailable, proceed without cache */ }
        }

        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setHours(0, 0, 0, 0);
        startOfThisWeek.setDate(now.getDate() - now.getDay());

        // We fetch practically everything for the workspace efficiently
        const [
            allTasks,
            allTimeLogs,
            teamMembers,
            recentActivities
        ] = await Promise.all([
            db.query.tasks.findMany({ where: eq(tasks.workspaceId, workspaceId) }),
            db.execute(sql`
                SELECT tl.hours, tl.log_date, t.estimated_hours 
                FROM time_logs tl
                JOIN tasks t ON tl.task_id = t.id
                WHERE t.workspace_id = ${workspaceId}
            `),
            db.query.workspaceMembers.findMany({ where: eq(workspaceMembers.workspaceId, workspaceId) }),
            db.execute(sql`
                SELECT ta.id, ta.task_id, ta.action, ta.created_at, u.email, t.title
                FROM task_activities ta
                JOIN users u ON ta.user_id = u.id
                JOIN tasks t ON ta.task_id = t.id
                WHERE t.workspace_id = ${workspaceId}
                ORDER BY ta.created_at DESC
                LIMIT 20
            `)
        ]);

        // Pre-compute parsed dates once per task to avoid redundant Date construction
        const enrichedTasks = allTasks.map(t => ({
            ...t,
            _parsedDueDate: t.dueDate ? new Date(t.dueDate) : null,
            _estimatedHours: parseFloat(t.estimatedHours as any || '0'),
        }));

        const totalTasks = enrichedTasks.length;
        const completedTasks = enrichedTasks.filter(t => t.status === 'DONE').length;
        const inProgressTasks = enrichedTasks.filter(t => t.status === 'IN_PROGRESS').length;
        const overdueTasks = enrichedTasks.filter(t => t.status !== 'DONE' && t._parsedDueDate && t._parsedDueDate < now).length;
        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        let totalEstimatedHours = 0;
        enrichedTasks.forEach(t => {
            totalEstimatedHours += t._estimatedHours;
        });

        let totalLoggedHours = 0;
        allTimeLogs.rows.forEach((row: any) => {
            totalLoggedHours += parseFloat(row.hours || '0');
        });

        const stats = {
            totalTasks,
            completedTasks,
            inProgressTasks,
            overdueTasks,
            completionPercent,
            totalEstimatedHours,
            totalLoggedHours,
            teamSize: teamMembers.length
        };

        const tasksByStatus = [
            { status: 'TODO', count: enrichedTasks.filter(t => t.status === 'TODO').length },
            { status: 'IN_PROGRESS', count: inProgressTasks },
            { status: 'DONE', count: completedTasks },
        ];

        const tasksByPriority = [
            { priority: 'LOW', count: enrichedTasks.filter(t => t.priority === 'LOW').length },
            { priority: 'MEDIUM', count: enrichedTasks.filter(t => t.priority === 'MEDIUM').length },
            { priority: 'HIGH', count: enrichedTasks.filter(t => t.priority === 'HIGH').length },
            { priority: 'URGENT', count: enrichedTasks.filter(t => t.priority === 'URGENT').length },
        ];

        // Upcoming deadlines
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const upcomingDeadlines = enrichedTasks
            .filter(t => t.status !== 'DONE' && t._parsedDueDate && t._parsedDueDate >= now && t._parsedDueDate <= nextWeek)
            .sort((a, b) => a._parsedDueDate!.getTime() - b._parsedDueDate!.getTime())
            .slice(0, 10);

        // Velocity & Completion Trend (Past 8 Weeks)
        const completionTrend = [];
        const teamVelocity = [];
        const budgetBurn = [];

        // Pre-sort time logs by date once for O(n) cumulative computation
        const sortedTimeLogs = [...allTimeLogs.rows]
            .map((r: any) => ({ date: new Date(r.log_date).getTime(), hours: parseFloat(r.hours || '0') }))
            .sort((a, b) => a.date - b.date);
        
        let timeLogIdx = 0;
        let cumLogged = 0;

        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(startOfThisWeek);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            const weekEndTime = weekEnd.getTime();
            
            const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

            const weekCreated = enrichedTasks.filter(t => t.createdAt >= weekStart && t.createdAt < weekEnd).length;
            const weekCompleted = enrichedTasks.filter(t => t.updatedAt >= weekStart && t.updatedAt < weekEnd && t.status === 'DONE').length;

            completionTrend.push({ week: weekLabel, created: weekCreated, completed: weekCompleted });
            teamVelocity.push({ week: weekLabel, tasksCompleted: weekCompleted });

            // Budget Burn — O(n) cumulative via pre-sorted index
            const cumEstimated = (totalEstimatedHours / 8) * (8 - i); 
            while (timeLogIdx < sortedTimeLogs.length && sortedTimeLogs[timeLogIdx].date < weekEndTime) {
                cumLogged += sortedTimeLogs[timeLogIdx].hours;
                timeLogIdx++;
            }
            budgetBurn.push({ date: weekLabel, planned: Math.round(cumEstimated * 50), actual: Math.round(cumLogged * 50) });
        }

        const dashboardData = {
            stats,
            tasksByStatus,
            tasksByPriority,
            completionTrend,
            teamVelocity,
            budgetBurn,
            upcomingDeadlines,
            recentActivity: recentActivities.rows.map((r: any) => ({
                id: r.id,
                taskId: r.task_id,
                taskTitle: r.title,
                action: r.action,
                userEmail: r.email,
                createdAt: r.created_at
            }))
        };

        if (isRedisReady()) {
            try { await redisClient.setex(cacheKey, 60, JSON.stringify(dashboardData)); } catch { /* skip */ }
        }

        return dashboardData;
    }

    async getPersonalDashboard(userId: string, workspaceId: string) {
        const cacheKey = `dashboard:personal:${workspaceId}:${userId}`;
        if (isRedisReady()) {
            try {
                const cached = await redisClient.get(cacheKey);
                if (cached) return JSON.parse(cached);
            } catch { /* Redis unavailable, proceed without cache */ }
        }

        const now = new Date();
        const startOfThisWeek = new Date(now);
        startOfThisWeek.setHours(0, 0, 0, 0);
        startOfThisWeek.setDate(now.getDate() - now.getDay());

        const [
            myTasks,
            myTimeLogs
        ] = await Promise.all([
            db.query.tasks.findMany({ 
                where: and(
                    eq(tasks.workspaceId, workspaceId),
                    eq(tasks.assignedTo, userId)
                ) 
            }),
            db.query.timeLogs.findMany({
                where: and(
                    eq(timeLogs.userId, userId),
                    gte(timeLogs.logDate, startOfThisWeek.toISOString() as any)
                )
            })
        ]);

        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);

        const endOfWeek = new Date(startOfThisWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        const myStats = {
            total: myTasks.length,
            overdue: myTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length,
            dueToday: myTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfToday).length,
            dueThisWeek: myTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= endOfWeek).length,
            completedThisWeek: myTasks.filter(t => t.status === 'DONE' && t.updatedAt >= startOfThisWeek && t.updatedAt <= endOfWeek).length
        };

        let myHoursThisWeek = 0;
        myTimeLogs.forEach(log => {
            myHoursThisWeek += parseFloat(log.hours as any || '0');
        });

        const myAssignedTasks = myTasks.filter(t => t.status !== 'DONE').slice(0, 10);
        const myUpcomingDeadlines = myTasks
            .filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) >= now)
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 10);

        const personalData = {
            myTasks: myStats,
            myHoursThisWeek,
            myAssignedTasks,
            myUpcomingDeadlines
        };

        if (isRedisReady()) {
            try { await redisClient.setex(cacheKey, 30, JSON.stringify(personalData)); } catch { /* skip */ }
        }

        return personalData;
    }

    async clearDashboardCache(workspaceId: string, userId?: string) {
        if (!isRedisReady()) return;
        try {
            await redisClient.del(CacheService.keys.workspaceDashboard(workspaceId));
            if (userId) {
                await redisClient.del(`dashboard:personal:${workspaceId}:${userId}`);
            } else {
                // Need to clear all personal dashboards for this workspace if a public task updates
                await cacheService.invalidatePattern(`dashboard:personal:${workspaceId}:*`);
            }
        } catch (e) {
            // Redis unavailable, skip cache clear
        }
    }
}

export const dashboardService = new DashboardService();
