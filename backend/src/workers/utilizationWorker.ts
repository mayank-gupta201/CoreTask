import { Worker, Job } from 'bullmq';
import { connection } from '../queue';
import { resourceRepository } from '../repositories/resource.repository';
import { redisClient } from '../services/cache.service';
import { getIO } from '../socket';
import { logger } from '../middlewares/logger.middleware';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// We forecast out +180 days for bounding performance efficiently on background workers
const UTILIZATION_WINDOW_DAYS = 180;

const utilizationWorker = new Worker(
    'utilizationQueue',
    async (job: Job) => {
        const { userId, workspaceId } = job.data;
        if (!userId || !workspaceId) throw new Error('UserId and WorkspaceId are required');

        logger.info(`Starting utilization computation for user ${userId} in workspace ${workspaceId}`);

        const dateFrom = new Date(); // Start evaluating from today
        const dateTo = new Date(dateFrom.getTime() + (UTILIZATION_WINDOW_DAYS * 24 * 60 * 60 * 1000));
        
        const utilizationData = await resourceRepository.getUserUtilization(userId, workspaceId, dateFrom, dateTo);

        // Analyze for overallocations (>100% per day)
        const overAllocatedDates = utilizationData
            .filter(d => d.isOverAllocated)
            .map(d => d.date);

        // Cache the raw array for 30 minutes
        const cacheKey = `util:${userId}:${workspaceId}`;
        await redisClient.setex(cacheKey, 1800, JSON.stringify(utilizationData));

        if (overAllocatedDates.length > 0) {
            // Find userName
            const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
            let userName = user?.email || 'Resource';
            if (userName.includes('@')) {
                userName = userName.split('@')[0];
            }

            logger.warn(`Overallocation detected for user ${userId} on ${overAllocatedDates.length} days.`);

            // Trigger proactive alert socket
            getIO().to(`workspace_${workspaceId}`).emit('resource:overallocated', {
                userId,
                userName,
                overAllocatedDates
            });
        }

        logger.info(`Utilization computation completed for user ${userId}. Cached successfully.`);
    },
    { connection: connection as any }
);

utilizationWorker.on('failed', (job, err) => {
    logger.error(`Utilization job failed for User: ${job?.data?.userId} with error: ${err.message}`);
});

export { utilizationWorker };
