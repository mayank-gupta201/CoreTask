import { Worker, Job } from 'bullmq';
import { db } from '../db';
import { tasks } from '../db/schema';
import { isNotNull, ne } from 'drizzle-orm';
import { logger } from '../middlewares/logger.middleware';
import { getIO } from '../socket';

/**
 * Calculates the next due date based on a recurrence rule.
 */
function getNextDueDate(rule: string, fromDate: Date): Date {
    const next = new Date(fromDate);
    switch (rule) {
        case 'DAILY':
            next.setDate(next.getDate() + 1);
            break;
        case 'WEEKLY':
            next.setDate(next.getDate() + 7);
            break;
        case 'MONTHLY':
            next.setMonth(next.getMonth() + 1);
            break;
        default:
            next.setDate(next.getDate() + 1);
    }
    return next;
}

/**
 * BullMQ Worker that processes recurring task generation.
 * Runs as a repeatable job at midnight every day.
 */
export function createRecurringTaskWorker(connection: any) {
    const worker = new Worker(
        'recurringTasksQueue',
        async (job: Job) => {
            logger.info(`[RecurringTaskWorker] Processing job ${job.id}...`);

            // Fetch all recurring task templates (non-instance, non-done tasks with a recurrence rule)
            const recurringTasks = await db
                .select()
                .from(tasks)
                .where(isNotNull(tasks.recurrenceRule));

            // Filter only active recurring base tasks (not instances, not done)
            const activeTasks = recurringTasks.filter(
                (t) => !t.isRecurringInstance && t.status !== 'DONE'
            );

            logger.info(`[RecurringTaskWorker] Found ${activeTasks.length} recurring tasks to process.`);

            let createdCount = 0;

            for (const task of activeTasks) {
                const baseDate = task.dueDate || task.createdAt;
                const nextDue = getNextDueDate(task.recurrenceRule!, baseDate);

                // Only create if the next due date is tomorrow or today
                const tomorrow = new Date();
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);

                const nextDueNormalized = new Date(nextDue);
                nextDueNormalized.setHours(0, 0, 0, 0);

                if (nextDueNormalized.getTime() <= tomorrow.getTime()) {
                    const [newTask] = await db.insert(tasks).values({
                        title: task.title,
                        description: task.description,
                        status: 'TODO',
                        priority: task.priority,
                        category: task.category,
                        dueDate: nextDue,
                        recurrenceRule: null, // Instance tasks don't recur themselves
                        isRecurringInstance: true,
                        workspaceId: task.workspaceId,
                        userId: task.userId,
                    }).returning();

                    createdCount++;

                    try {
                        getIO().to(`workspace_${task.workspaceId}`).emit('taskCreated', newTask);
                    } catch (e) {
                        // Socket may not be initialized in test environments
                    }
                }
            }

            logger.info(`[RecurringTaskWorker] Created ${createdCount} recurring task instances.`);
            return { created: createdCount };
        },
        { connection: connection as any }
    );

    worker.on('completed', (job) => {
        logger.debug(`[RecurringTaskWorker] Job ${job.id} completed.`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`[RecurringTaskWorker] Job ${job?.id} failed: ${err.message}`);
    });

    return worker;
}
