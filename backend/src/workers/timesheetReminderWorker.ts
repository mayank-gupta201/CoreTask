import cron from 'node-cron';
import { db } from '../db';
import { workspaceMembers, timesheets, users } from '../db/schema';
import { emailQueue } from '../queue';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../middlewares/logger.middleware';

/**
 * Scheduled every Friday at 4:00 PM (16:00).
 * Cron format: '0 16 * * 5'
 */
cron.schedule('0 16 * * 5', async () => {
    logger.info('Starting weekly timesheet reminder sub-routine...');
    try {
        // Calculate current week monday
        const d = new Date();
        const day = d.getDay() || 7; 
        const monday = new Date(d);
        monday.setDate(d.getDate() - day + 1);
        monday.setHours(0, 0, 0, 0);

        // Fetch all members missing a SUBMITTED/APPROVED timesheet for current week
        // We find all workspace members and join their current timesheets
        const allMembers = await db.select({
            userId: workspaceMembers.userId,
            email: users.email,
            status: timesheets.status
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .leftJoin(timesheets, 
            and(
                eq(timesheets.userId, workspaceMembers.userId),
                eq(timesheets.workspaceId, workspaceMembers.workspaceId),
                eq(timesheets.weekStart, monday.toISOString() as any)
            )
        );

        for (const member of allMembers) {
            // Need reminder if there's no timesheet created, or if it's still in DRAFT
            if (!member.status || member.status === 'DRAFT') {
                await emailQueue.add('timesheet-reminder', {
                    to: member.email,
                    subject: 'Action Required: Submit Your Weekly Timesheet',
                    type: 'NOTIFICATION',
                    payload: {
                        message: "Don't forget to submit your timesheet for this week! [Submit Now ->]"
                    }
                });
            }
        }
        
        logger.info('Timesheet reminder routines distributed successfully.');
    } catch (error) {
        logger.error(`Error executing timesheet reminders: ${error}`);
    }
});
