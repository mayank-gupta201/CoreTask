import { db } from '../db';
import { timesheets, timeLogs, tasks, users } from '../db/schema';
import { eq, and, sql, desc, gte, lte } from 'drizzle-orm';
import { ProblemDetails } from '../errors';

export class TimesheetRepository {
    async getOrCreateTimesheet(userId: string, workspaceId: string, weekStart: Date, weekEnd: Date) {
        // Try to find it
        const [existing] = await db.select()
            .from(timesheets)
            .where(
                and(
                    eq(timesheets.userId, userId),
                    eq(timesheets.workspaceId, workspaceId),
                    eq(timesheets.weekStart, weekStart.toISOString() as any) // Drizzle casts Dates properly, using string for safety if date types act funny
                )
            );

        if (existing) return existing;

        // Create if missing
        const [created] = await db.insert(timesheets).values({
            userId,
            workspaceId,
            weekStart: weekStart.toISOString() as any,
            weekEnd: weekEnd.toISOString() as any,
            status: 'DRAFT'
        }).returning();

        return created;
    }

    async getTimesheetById(id: string) {
        // Join with timeLogs and tasks
        const ts = await db.query.timesheets.findFirst({
            where: eq(timesheets.id, id),
            with: {
                timeLogs: {
                    with: {
                        task: true
                    }
                }
            }
        });
        return ts;
    }

    async getTimesheetsByWorkspace(workspaceId: string, filters: { userId?: string, status?: string, weekStart?: Date }) {
        let conditions = [eq(timesheets.workspaceId, workspaceId)];

        if (filters.userId) conditions.push(eq(timesheets.userId, filters.userId));
        if (filters.status) conditions.push(eq(timesheets.status, filters.status));
        if (filters.weekStart) conditions.push(eq(timesheets.weekStart, filters.weekStart.toISOString() as any));

        return await db.query.timesheets.findMany({
            where: and(...conditions),
            with: {
                user: true,
                timeLogs: true
            },
            orderBy: [desc(timesheets.weekStart)]
        });
    }

    async logTime(timesheetId: string, data: { taskId?: string, logDate: Date, hours: number, notes?: string, userId: string }) {
        const [log] = await db.insert(timeLogs).values({
            timesheetId,
            taskId: data.taskId || null,
            userId: data.userId,
            logDate: data.logDate.toISOString() as any,
            hours: data.hours.toString() as any, // Decimal type
            notes: data.notes
        }).returning();
        return log;
    }

    async updateTimeLog(id: string, data: { hours?: number, notes?: string }) {
        const updates: any = { updatedAt: new Date() };
        if (data.hours !== undefined) updates.hours = data.hours.toString();
        if (data.notes !== undefined) updates.notes = data.notes;

        const [log] = await db.update(timeLogs)
            .set(updates)
            .where(eq(timeLogs.id, id))
            .returning();
        return log;
    }

    async deleteTimeLog(id: string, userId: string) {
        // Find log
        const log = await db.query.timeLogs.findFirst({
            where: and(eq(timeLogs.id, id), eq(timeLogs.userId, userId)),
            with: { timesheet: true }
        });

        if (!log) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Time log not found.' });
        if (log.timesheet.status !== 'DRAFT') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Cannot delete logs from a submitted or approved timesheet.' });

        await db.delete(timeLogs).where(eq(timeLogs.id, id));
        return true;
    }

    async getLastWeekLogs(userId: string, workspaceId: string, currentWeekStart: Date) {
        const prevWeekStart = new Date(currentWeekStart);
        prevWeekStart.setDate(prevWeekStart.getDate() - 7);

        // Find last week's timesheet
        const ts = await db.query.timesheets.findFirst({
            where: and(
                eq(timesheets.userId, userId),
                eq(timesheets.workspaceId, workspaceId),
                eq(timesheets.weekStart, prevWeekStart.toISOString() as any)
            ),
            with: {
                timeLogs: true
            }
        });

        return ts?.timeLogs || [];
    }

    async submitTimesheet(id: string, userId: string) {
        const [res] = await db.update(timesheets)
            .set({ status: 'SUBMITTED', submittedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(timesheets.id, id), eq(timesheets.userId, userId), eq(timesheets.status, 'DRAFT')))
            .returning();
        return res;
    }

    async approveTimesheet(id: string, approverId: string) {
        const [res] = await db.update(timesheets)
            .set({ status: 'APPROVED', approvedBy: approverId, approvedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(timesheets.id, id), eq(timesheets.status, 'SUBMITTED')))
            .returning();
        return res;
    }

    async rejectTimesheet(id: string, approverId: string, reason: string) {
        const [res] = await db.update(timesheets)
            .set({ status: 'REJECTED', rejectionReason: reason, updatedAt: new Date() })
            .where(and(eq(timesheets.id, id), eq(timesheets.status, 'SUBMITTED')))
            .returning();
        return res;
    }

    async getTimesheetStats(workspaceId: string, dateFrom: Date, dateTo: Date) {
        // Aggregate hours per user per task
        const stats = await db.select({
            userId: timeLogs.userId,
            userName: users.email, // using email as fallback or name if we had it
            taskId: timeLogs.taskId,
            taskTitle: tasks.title,
            totalHours: sql<number>`SUM(${timeLogs.hours})`
        })
        .from(timeLogs)
        .leftJoin(timesheets, eq(timeLogs.timesheetId, timesheets.id))
        .leftJoin(users, eq(timeLogs.userId, users.id))
        .leftJoin(tasks, eq(timeLogs.taskId, tasks.id))
        .where(
            and(
                eq(timesheets.workspaceId, workspaceId),
                gte(timeLogs.logDate, dateFrom.toISOString() as any),
                lte(timeLogs.logDate, dateTo.toISOString() as any)
            )
        )
        .groupBy(timeLogs.userId, timeLogs.taskId, users.email, tasks.title);

        return stats;
    }
}

export const timesheetRepository = new TimesheetRepository();
