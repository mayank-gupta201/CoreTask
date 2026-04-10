import { db } from '../db';
import { 
    taskAssignments, resourceAvailability, holidays, userCostRates, tasks, users 
} from '../db/schema';
import { eq, and, gte, lte, isNull, between, sql, or, isNotNull } from 'drizzle-orm';
import { startOfDay, endOfDay, addDays, getDay, isAfter, isBefore } from 'date-fns';

export class ResourceRepository {
    async assignUserToTask(taskId: string, userId: string, allocationPercent: number, assignedBy: string) {
        const [assignment] = await db.insert(taskAssignments).values({
            taskId,
            userId,
            allocationPercent,
            assignedBy
        }).onConflictDoUpdate({
            target: [taskAssignments.taskId, taskAssignments.userId],
            set: { allocationPercent, assignedBy, assignedAt: new Date() }
        }).returning();
        return assignment;
    }

    async removeAssignment(taskId: string, userId: string) {
        const result = await db.delete(taskAssignments)
            .where(and(eq(taskAssignments.taskId, taskId), eq(taskAssignments.userId, userId)))
            .returning();
        return result.length > 0;
    }

    async getTaskAssignments(taskId: string) {
        return await db.query.taskAssignments.findMany({
            where: eq(taskAssignments.taskId, taskId),
            with: {
                user: {
                    columns: { id: true, email: true }
                }
            }
        });
    }

    async getWorkspaceAssignments(workspaceId: string, dateFrom: Date, dateTo: Date) {
        return await db
            .select({
                assignmentId: taskAssignments.id,
                userId: taskAssignments.userId,
                taskId: taskAssignments.taskId,
                allocationPercent: taskAssignments.allocationPercent,
                taskTitle: tasks.title,
                startDate: tasks.startDate,
                dueDate: tasks.dueDate,
                status: tasks.status
            })
            .from(taskAssignments)
            .innerJoin(tasks, eq(tasks.id, taskAssignments.taskId))
            .where(
                and(
                    eq(tasks.workspaceId, workspaceId),
                    isNull(tasks.deletedAt),
                    // Task must intersect with the date range
                    // startDate <= dateTo AND (dueDate IS NULL OR dueDate >= dateFrom)
                    lte(tasks.startDate, dateTo),
                    or(isNull(tasks.dueDate), gte(tasks.dueDate, dateFrom))
                )
            );
    }

    async getUserUtilization(userId: string, workspaceId: string, dateFrom: Date, dateTo: Date) {
        // Find tasks assigned to this user in this workspace
        const records = await db
            .select({
                taskId: tasks.id,
                startDate: tasks.startDate,
                dueDate: tasks.dueDate,
                allocationPercent: taskAssignments.allocationPercent
            })
            .from(taskAssignments)
            .innerJoin(tasks, eq(tasks.id, taskAssignments.taskId))
            .where(
                and(
                    eq(taskAssignments.userId, userId),
                    eq(tasks.workspaceId, workspaceId),
                    isNull(tasks.deletedAt),
                    isNotNull(tasks.startDate), // Need a start date to plan
                    lte(tasks.startDate, dateTo),
                    or(isNull(tasks.dueDate), gte(tasks.dueDate, dateFrom))
                )
            );

        // Calculate daily sums
        const dailyData: Record<string, number> = {};
        
        let curr = startOfDay(dateFrom);
        const end = endOfDay(dateTo);
        
        while (curr <= end) {
            const dateStr = curr.toISOString().split('T')[0];
            let totalAlloc = 0;
            
            // Skip weekends by default (optional, can be refined based on availability records) // Simplified for MVP
            const dayOfWeek = getDay(curr);
            if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday or Saturday
                 for (const record of records) {
                    const tStart = startOfDay(record.startDate!);
                    const tEnd = record.dueDate ? endOfDay(record.dueDate) : addDays(tStart, 1);
                    
                    if (curr >= tStart && curr <= tEnd) {
                        totalAlloc += (record.allocationPercent ?? 100);
                    }
                }
            }
            
            dailyData[dateStr] = totalAlloc;
            curr = addDays(curr, 1);
        }
        
        return Object.entries(dailyData).map(([date, totalAllocation]) => ({
            date,
            totalAllocation,
            isOverAllocated: totalAllocation > 100
        }));
    }

    async setAvailability(userId: string, workspaceId: string, availableHoursPerDay: number, effectiveFrom: Date, effectiveTo?: Date) {
        const [avail] = await db.insert(resourceAvailability).values({
            userId,
            workspaceId,
            availableHoursPerDay: availableHoursPerDay.toString(),
            effectiveFrom: effectiveFrom.toISOString().split('T')[0],
            effectiveTo: effectiveTo ? effectiveTo.toISOString().split('T')[0] : null
        }).returning();
        return avail;
    }

    async getAvailability(userId: string, workspaceId: string, date: Date) {
        const dateStr = date.toISOString().split('T')[0];
        const [record] = await db
            .select()
            .from(resourceAvailability)
            .where(
                and(
                    eq(resourceAvailability.userId, userId),
                    eq(resourceAvailability.workspaceId, workspaceId),
                    lte(resourceAvailability.effectiveFrom, dateStr),
                    or(isNull(resourceAvailability.effectiveTo), gte(resourceAvailability.effectiveTo, dateStr))
                )
            )
            .orderBy(sql`${resourceAvailability.effectiveFrom} DESC`)
            .limit(1);
        
        return record;
    }

    async createHoliday(workspaceId: string, name: string, date: Date, isRecurring: boolean, createdBy: string, region?: string) {
        const [holiday] = await db.insert(holidays).values({
            workspaceId,
            name,
            date: date.toISOString().split('T')[0],
            isRecurring,
            region,
            createdBy
        }).returning();
        return holiday;
    }

    async getHolidays(workspaceId: string, year: number) {
        // Fetch explicit holidays in that year, or recurring holidays
        const startOfYearStr = `${year}-01-01`;
        const endOfYearStr = `${year}-12-31`;
        
        return await db
            .select()
            .from(holidays)
            .where(
                and(
                    eq(holidays.workspaceId, workspaceId),
                    or(
                        between(holidays.date, startOfYearStr, endOfYearStr),
                        eq(holidays.isRecurring, true)
                    )
                )
            );
    }

    async deleteHoliday(id: string, workspaceId: string) {
        const result = await db.delete(holidays)
            .where(and(eq(holidays.id, id), eq(holidays.workspaceId, workspaceId)))
            .returning();
        return result.length > 0;
    }

    async setUserCostRate(userId: string, workspaceId: string, hourlyRate: number, currency: string, effectiveFrom: Date) {
        const [rate] = await db.insert(userCostRates).values({
            userId,
            workspaceId,
            hourlyRate: hourlyRate.toString(),
            currency,
            effectiveFrom: effectiveFrom.toISOString().split('T')[0]
        }).returning();
        return rate;
    }

    async getUserCostRate(userId: string, workspaceId: string, date: Date) {
        const dateStr = date.toISOString().split('T')[0];
        const [record] = await db
            .select()
            .from(userCostRates)
            .where(
                and(
                    eq(userCostRates.userId, userId),
                    eq(userCostRates.workspaceId, workspaceId),
                    lte(userCostRates.effectiveFrom, dateStr)
                )
            )
            .orderBy(sql`${userCostRates.effectiveFrom} DESC`)
            .limit(1);
            
        return record;
    }

    async getResourceGridData(workspaceId: string, dateFrom: Date, dateTo: Date) {
        // 1. Find all active members of the workspace
        const workspaceUsers = await db.select({
            id: users.id,
            email: users.email,
        })
        .from(users)
        .innerJoin(db.select().from(require('../db/schema').workspaceMembers).where(eq(require('../db/schema').workspaceMembers.workspaceId, workspaceId)).as('wm'), eq(users.id, sql`"wm"."user_id"`));

        const assignmentsQuery = await this.getWorkspaceAssignments(workspaceId, dateFrom, dateTo);
        const holidaysData = await this.getHolidays(workspaceId, dateFrom.getFullYear());

        const grid: Array<{
            user: { id: string, name: string, email: string },
            dailyData: Array<{
                date: string,
                totalAllocation: number,
                isHoliday: boolean,
                isOverAllocated: boolean,
                tasks: Array<{ taskId: string, taskTitle: string, allocation: number }>
            }>
        }> = [];

        for (const user of workspaceUsers) {
            const userAssignments = assignmentsQuery.filter(a => a.userId === user.id);
            const userDaily: any[] = [];
            
            let curr = startOfDay(dateFrom);
            const end = endOfDay(dateTo);

            while (curr <= end) {
                const dateStr = curr.toISOString().split('T')[0];
                const dayOfWeek = getDay(curr);
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                // isHoliday if it matches a holiday row
                const isHoliday = holidaysData.some(h => {
                    if (h.isRecurring) {
                        return h.date.substring(5) === dateStr.substring(5); // Compare MM-DD
                    }
                    return h.date === dateStr;
                });

                let totalAlloc = 0;
                const activeTasks: any[] = [];

                if (!isWeekend && !isHoliday) {
                    for (const a of userAssignments) {
                        const tStart = startOfDay(a.startDate!);
                        const tEnd = a.dueDate ? endOfDay(a.dueDate) : addDays(tStart, 1);
                        
                        if (curr >= tStart && curr <= tEnd) {
                            const alloc = a.allocationPercent ?? 100;
                            totalAlloc += alloc;
                            activeTasks.push({
                                taskId: a.taskId,
                                taskTitle: a.taskTitle,
                                allocation: alloc
                            });
                        }
                    }
                }

                userDaily.push({
                    date: dateStr,
                    totalAllocation: totalAlloc,
                    isHoliday: isHoliday || isWeekend, // We model weekends naturally as rest/holidays 
                    isOverAllocated: totalAlloc > 100,
                    tasks: activeTasks
                });

                curr = addDays(curr, 1);
            }

            grid.push({
                user: { id: user.id, name: user.email.split('@')[0], email: user.email },
                dailyData: userDaily
            });
        }

        return grid;
    }
}

export const resourceRepository = new ResourceRepository();
