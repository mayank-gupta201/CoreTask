import { Worker, Job } from 'bullmq';
import { connection } from '../queue';
import { db } from '../db';
import { tasks, taskDependencies } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { redisClient } from '../services/cache.service';
import { getIO } from '../socket';
import { logger } from '../middlewares/logger.middleware';

/**
 * Calculates Critical Path Method (CPM) zero-float critical tasks.
 */
const criticalPathWorker = new Worker(
    'criticalPathQueue',
    async (job: Job) => {
        const { workspaceId } = job.data;
        if (!workspaceId) throw new Error('WorkspaceId is required');

        logger.info(`Starting CPM computation for workspace ${workspaceId}`);

        // 1. Fetch Tasks & Dependencies
        const allTasks = await db.query.tasks.findMany({
            where: and(eq(tasks.workspaceId, workspaceId), isNull(tasks.deletedAt)),
            with: { successors: true }
        });

        if (allTasks.length === 0) return;

        // Build Graph representation
        type TaskNode = {
            id: string;
            duration: number; // hours
            es: number; // Early Start
            ef: number; // Early Finish
            ls: number; // Late Start
            lf: number; // Late Finish
            float: number;
            predecessors: string[];
            successors: string[];
        };

        const graph: Record<string, TaskNode> = {};
        allTasks.forEach(t => {
            graph[t.id] = {
                id: t.id,
                duration: t.estimatedHours ? Number(t.estimatedHours) : 8, // fallback 8 hours
                es: 0,
                ef: 0,
                ls: 0,
                lf: 0,
                float: 0,
                predecessors: [],
                successors: t.successors.map(d => d.successorTaskId)
            };
        });

        // Set predecessors
        allTasks.forEach(t => {
            t.successors.forEach(d => {
                if (graph[d.successorTaskId]) {
                    graph[d.successorTaskId].predecessors.push(t.id);
                }
            });
        });

        // 2. Topological Sort (Kahn's Algorithm)
        const inDegree: Record<string, number> = {};
        Object.keys(graph).forEach(id => { inDegree[id] = graph[id].predecessors.length; });

        const queue: string[] = Object.keys(inDegree).filter(id => inDegree[id] === 0);
        const topoOrder: string[] = [];

        while (queue.length > 0) {
            const curr = queue.shift()!;
            topoOrder.push(curr);
            graph[curr].successors.forEach(succ => {
                inDegree[succ]--;
                if (inDegree[succ] === 0) queue.push(succ);
            });
        }

        if (topoOrder.length !== Object.keys(graph).length) {
            logger.warn(`Circular dependency detected passively in Worker for workspace ${workspaceId}, aborting CPM.`);
            return;
        }

        // 3. Forward Pass (ES & EF)
        let projectDuration = 0;
        topoOrder.forEach(id => {
            const node = graph[id];
            node.es = node.predecessors.length === 0 
                ? 0 
                : Math.max(...node.predecessors.map(p => graph[p].ef));

            node.ef = node.es + node.duration;
            projectDuration = Math.max(projectDuration, node.ef);
        });

        // 4. Backward Pass (LS & LF)
        const reverseOrder = [...topoOrder].reverse();
        reverseOrder.forEach(id => {
            const node = graph[id];
            node.lf = node.successors.length === 0
                ? projectDuration
                : Math.min(...node.successors.map(s => graph[s].ls));

            node.ls = node.lf - node.duration;
            node.float = node.ls - node.es;
        });

        // 5. Extract Critical Path (Zero Float)
        const criticalPathTaskIds = Object.values(graph)
            .filter(node => node.float === 0)
            .map(node => node.id);

        // 6. Save to Redis Cache (60 minute TTL)
        const cacheKey = `critical-path:${workspaceId}`;
        await redisClient.setex(cacheKey, 3600, JSON.stringify(criticalPathTaskIds));

        // 7. Emit WebSocket event
        getIO().to(`workspace_${workspaceId}`).emit('critical-path:updated', { 
            workspaceId, 
            criticalPathTaskIds 
        });

        logger.info(`CPM computation completed for workspace ${workspaceId}. Critical tasks: ${criticalPathTaskIds.length}`);
    },
    { connection: connection as any }
);

criticalPathWorker.on('failed', (job, err) => {
    logger.error(`Critical Path job failed for workspace ${job?.data?.workspaceId} with error: ${err.message}`);
});

export { criticalPathWorker };
