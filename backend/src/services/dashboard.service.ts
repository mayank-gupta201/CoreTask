import { eq, sql, desc, and, inArray, gte, lt } from 'drizzle-orm';
import { db } from '../db';
import { tasks, taskActivities, timeLogs, workspaceMembers, users } from '../db/schema';
import { redisClient } from './cache.service';

export class DashboardService {
    async getProjectDashboard(workspaceId: string) {
        const cacheKey = `dashboard:${workspaceId}`;
        if (redisClient) {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
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
                SELECT tl.hours, tl.date, t.estimated_hours 
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

        const totalTasks = allTasks.length;
        const completedTasks = allTasks.filter(t => t.status === 'DONE').length;
        const inProgressTasks = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
        const overdueTasks = allTasks.filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < now).length;
        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        
        let totalEstimatedHours = 0;
        allTasks.forEach(t => {
            totalEstimatedHours += parseFloat(t.estimatedHours as any || '0');
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
            { status: 'TODO', count: allTasks.filter(t => t.status === 'TODO').length },
            { status: 'IN_PROGRESS', count: inProgressTasks },
            { status: 'DONE', count: completedTasks },
        ];

        const tasksByPriority = [
            { priority: 'LOW', count: allTasks.filter(t => t.priority === 'LOW').length },
            { priority: 'MEDIUM', count: allTasks.filter(t => t.priority === 'MEDIUM').length },
            { priority: 'HIGH', count: allTasks.filter(t => t.priority === 'HIGH').length },
            { priority: 'URGENT', count: allTasks.filter(t => t.priority === 'URGENT').length },
        ];

        // Upcoming deadlines
        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 7);
        const upcomingDeadlines = allTasks
            .filter(t => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) >= now && new Date(t.dueDate) <= nextWeek)
            .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
            .slice(0, 10);

        // Velocity & Completion Trend (Past 8 Weeks)
        const completionTrend = [];
        const teamVelocity = [];
        const budgetBurn = []; // Let's mock a simple linear plan vs actual for 8 weeks
        
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(startOfThisWeek);
            weekStart.setDate(weekStart.getDate() - (i * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            
            const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;

            const weekCreated = allTasks.filter(t => t.createdAt >= weekStart && t.createdAt < weekEnd).length;
            const weekCompleted = allTasks.filter(t => t.updatedAt >= weekStart && t.updatedAt < weekEnd && t.status === 'DONE').length;

            completionTrend.push({ week: weekLabel, created: weekCreated, completed: weekCompleted });
            teamVelocity.push({ week: weekLabel, tasksCompleted: weekCompleted });

            // Budget Burn logic (very roughly using cumulative values up to that week)
            const cumEstimated = (totalEstimatedHours / 8) * (8 - i); 
            let cumLogged = 0;
            allTimeLogs.rows.forEach((r: any) => {
                if (new Date(r.date) < weekEnd) {
                    cumLogged += parseFloat(r.hours || '0');
                }
            });
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

        if (redisClient) {
            await redisClient.setex(cacheKey, 60, JSON.stringify(dashboardData));
        }

        return dashboardData;
    }

    async getPersonalDashboard(userId: string, workspaceId: string) {
        const cacheKey = `dashboard:personal:${workspaceId}:${userId}`;
        if (redisClient) {
            const cached = await redisClient.get(cacheKey);
            if (cached) return JSON.parse(cached);
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

        if (redisClient) {
            await redisClient.setex(cacheKey, 30, JSON.stringify(personalData));
        }

        return personalData;
    }

    async clearDashboardCache(workspaceId: string, userId?: string) {
        if (!redisClient) return;
        await redisClient.del(`dashboard:${workspaceId}`);
        if (userId) {
            await redisClient.del(`dashboard:personal:${workspaceId}:${userId}`);
        } else {
            // Need to clear all personal dashboards for this workspace if a public task updates
            try {
                let cursor = '0';
                do {
                    const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', `dashboard:personal:${workspaceId}:*`, 'COUNT', 100);
                    cursor = nextCursor;
                    if (keys.length > 0) {
                        await redisClient.del(...keys);
                    }
                } while (cursor !== '0');
            } catch (e) {
                // Ignore err
            }
        }
    }
}

export const dashboardService = new DashboardService();
