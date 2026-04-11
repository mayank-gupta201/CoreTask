import { timesheetRepository } from '../repositories/timesheet.repository';
import { db } from '../db';
import { tasks, workspaceMembers, userCostRates, timesheets } from '../db/schema';
import { eq, and, gt, lte, gte } from 'drizzle-orm';
import { ProblemDetails } from '../errors';
import { getIO } from '../socket';
import { emailQueue } from '../queue';
import { format } from 'fast-csv';

export class TimesheetService {
    // Computes Monday and Sunday of a given date
    private getWeekBoundaries(dateStr?: string) {
        const d = dateStr ? new Date(dateStr) : new Date();
        const day = d.getDay() || 7; // Convert 0 (Sunday) to 7
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        return { monday, sunday };
    }

    async getCurrentTimesheet(userId: string, workspaceId: string, weekStartParam?: string) {
        const { monday, sunday } = this.getWeekBoundaries(weekStartParam);
        const ts = await timesheetRepository.getOrCreateTimesheet(userId, workspaceId, monday, sunday);
        
        // Fetch full relationships including logs
        return await timesheetRepository.getTimesheetById(ts.id);
    }

    async logHours(userId: string, workspaceId: string, timesheetId: string, data: { taskId?: string, logDate: string, hours: number, notes?: string }) {
        const ts = await timesheetRepository.getTimesheetById(timesheetId);
        if (!ts) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Timesheet not found.' });
        if (ts.userId !== userId) throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Cannot modify another user\'s timesheet.' });
        if (ts.status !== 'DRAFT') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Timesheet is already submitted or approved.' });

        if (data.taskId) {
            const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, data.taskId), eq(tasks.workspaceId, workspaceId))).limit(1);
            if (!task) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Task not found in this workspace.' });
        }

        if (data.hours <= 0 || data.hours > 24) {
            throw new ProblemDetails({ status: 400, title: 'Bad Request', detail: 'Hours must be between 0.1 and 24.' });
        }

        // Check if logDate already exceeds 24h total
        const currentLogs = ts.timeLogs.filter((l: any) => l.logDate === data.logDate);
        const existingHours = currentLogs.reduce((acc: number, l: any) => acc + parseFloat(l.hours), 0);
        if (existingHours + data.hours > 24) {
            throw new ProblemDetails({ status: 400, title: 'Bad Request', detail: `Total hours for ${data.logDate} cannot exceed 24. Existing: ${existingHours}h.` });
        }

        const logDateObj = new Date(data.logDate);
        const log = await timesheetRepository.logTime(timesheetId, { ...data, logDate: logDateObj, userId });

        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('timelog:added', { timesheetId, logId: log.id });

        return log;
    }

    async autoFillFromLastWeek(userId: string, workspaceId: string, timesheetId: string) {
        const ts = await timesheetRepository.getTimesheetById(timesheetId);
        if (!ts || ts.userId !== userId) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Timesheet not found.' });
        if (ts.status !== 'DRAFT') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Timesheet is already submitted.' });

        const currentWeekStart = new Date(ts.weekStart);
        const prevLogs = await timesheetRepository.getLastWeekLogs(userId, workspaceId, currentWeekStart);

        let createdCount = 0;
        for (const prevLog of prevLogs) {
            // Verify task still exists and isn't deleted (assuming hard delete or lacking deletedAt filter but we keep it simple)
            if (prevLog.taskId) {
                const [task] = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, prevLog.taskId)).limit(1);
                if (!task) continue; // Task missing/deleted
            }

            const newLogDate = new Date(prevLog.logDate);
            newLogDate.setDate(newLogDate.getDate() + 7);

            await timesheetRepository.logTime(timesheetId, {
                taskId: prevLog.taskId || undefined,
                logDate: newLogDate,
                hours: parseFloat(prevLog.hours as any),
                notes: prevLog.notes || undefined,
                userId
            });
            createdCount++;
        }

        return { createdCount };
    }

    async submitTimesheet(userId: string, workspaceId: string, timesheetId: string) {
        const ts = await timesheetRepository.getTimesheetById(timesheetId);
        if (!ts || ts.userId !== userId) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Timesheet not found.' });
        if (ts.status !== 'DRAFT') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Timesheet is already submitted.' });
        if (ts.timeLogs.length === 0) throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Cannot submit an empty timesheet.' });

        const submitted = await timesheetRepository.submitTimesheet(timesheetId, userId);

        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('timesheet:submitted', { timesheetId, userId });

        // Notify Project Managers
        const managers = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'PROJECT_MANAGER')));
        
        // Find users emails and send email (stub mapping actual emails)
        for(const mgr of managers) {
            await emailQueue.add('timesheet-submitted', {
                to: 'pm@taskmaster.app', // In real app: map mgr.userId to user.email
                subject: `Timesheet Submitted: User ${userId}`,
                type: 'NOTIFICATION',
                payload: { timesheetId }
            });
        }

        return submitted;
    }

    async approveTimesheet(approverId: string, workspaceId: string, timesheetId: string) {
        const [member] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, approverId), eq(workspaceMembers.workspaceId, workspaceId))).limit(1);
        if (!member || (member.role !== 'PROJECT_MANAGER' && member.role !== 'ADMIN' && member.role !== 'OWNER')) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Must be a Manager or Admin to approve.' });
        }

        const ts = await timesheetRepository.getTimesheetById(timesheetId);
        if (!ts) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Timesheet not found.' });
        if (ts.status !== 'SUBMITTED') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Timesheet must be submitted to approve.' });

        const approved = await timesheetRepository.approveTimesheet(timesheetId, approverId);

        getIO().to(`workspace_${workspaceId}`).emit('timesheet:approved', { timesheetId, userId: ts.userId });
        
        await emailQueue.add('timesheet-approved', {
            to: 'owner@taskmaster.app', 
            subject: `Timesheet Approved!`,
            type: 'NOTIFICATION',
            payload: { timesheetId }
        });

        return approved;
    }

    async rejectTimesheet(approverId: string, workspaceId: string, timesheetId: string, reason: string) {
        const [member] = await db.select({ role: workspaceMembers.role }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, approverId), eq(workspaceMembers.workspaceId, workspaceId))).limit(1);
        if (!member || (member.role !== 'PROJECT_MANAGER' && member.role !== 'ADMIN' && member.role !== 'OWNER')) {
            throw new ProblemDetails({ status: 403, title: 'Forbidden', detail: 'Must be a Manager or Admin to reject.' });
        }

        const ts = await timesheetRepository.getTimesheetById(timesheetId);
        if (!ts) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Timesheet not found.' });
        if (ts.status !== 'SUBMITTED') throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Timesheet must be submitted to reject.' });

        const rejected = await timesheetRepository.rejectTimesheet(timesheetId, approverId, reason);

        getIO().to(`workspace_${workspaceId}`).emit('timesheet:rejected', { timesheetId, userId: ts.userId });

        await emailQueue.add('timesheet-rejected', {
            to: 'owner@taskmaster.app', 
            subject: `Timesheet Rejected`,
            type: 'NOTIFICATION',
            payload: { timesheetId, reason }
        });

        return rejected;
    }

    async exportPayroll(workspaceId: string, weekStart: string, weekEnd: string, requesterId: string) {
        // Find all APPROVED timesheets between dates
        const approvedTimesheets = await db.query.timesheets.findMany({
            where: and(
                eq(timesheets.workspaceId, workspaceId),
                eq(timesheets.status, 'APPROVED'),
                gte(timesheets.weekStart, new Date(weekStart).toISOString() as any),
                lte(timesheets.weekEnd, new Date(weekEnd).toISOString() as any)
            ),
            with: {
                user: true,
                timeLogs: {  with: { task: true } }
            }
        });

        // Load all cost rates in workspace
        const rates = await db.select().from(userCostRates).where(eq(userCostRates.workspaceId, workspaceId));
        const rateMap = new Map(); // userId -> hourlyRate
        for(const r of rates) rateMap.set(r.userId, parseFloat(r.hourlyRate as any));

        const csvData: any[] = [];
        for (const ts of approvedTimesheets) {
            const userRate = rateMap.get(ts.userId) || 0;
            
            for (const log of ts.timeLogs) {
                const hours = parseFloat((log as any).hours);
                const cost = hours * userRate;

                csvData.push({
                    UserName: ts.user.email,
                    WeekStart: ts.weekStart,
                    DateLogged: log.logDate,
                    TaskTitle: (log.task as any)?.title || 'Unassigned Time',
                    HoursLogged: hours,
                    HourlyRate: userRate,
                    TotalCost: cost
                });
            }
        }

        return new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            const csvStream = format({ headers: true });
            csvStream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            csvStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
            csvStream.on('error', (err) => reject(err));

            for(const row of csvData) {
                csvStream.write(row);
            }
            csvStream.end();
        });
    }
}

export const timesheetService = new TimesheetService();
