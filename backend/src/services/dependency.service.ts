import { getIO } from '../socket';
import { dependencyRepository } from '../repositories/dependency.repository';
import { criticalPathQueue } from '../queue';
import { db } from '../db';
import { tasks } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ProblemDetails } from '../errors';

export class DependencyService {
    async addDependency(
        workspaceId: string, 
        userId: string, 
        body: { predecessorTaskId: string, successorTaskId: string, dependencyType: string, lagDays?: number }
    ) {
        const { predecessorTaskId, successorTaskId, dependencyType, lagDays = 0 } = body;

        // 1. Verify both tasks belong to workspaceId
        const [predecessor] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, predecessorTaskId), eq(tasks.workspaceId, workspaceId))).limit(1);
        const [successor] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, successorTaskId), eq(tasks.workspaceId, workspaceId))).limit(1);

        if (!predecessor || !successor) {
            throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'One or both tasks do not exist in this workspace.' });
        }

        // 2. Check for circular dependency
        const isCircular = await dependencyRepository.checkCircular(predecessorTaskId, successorTaskId);
        if (isCircular) {
            throw new ProblemDetails({ status: 422, title: 'Unprocessable Entity', detail: 'Circular dependency detected.' });
        }

        // 3. Create dependency
        const dependency = await dependencyRepository.createDependency({
            predecessorTaskId,
            successorTaskId,
            dependencyType,
            lagDays,
            createdBy: userId
        });

        // 4. Emit Socket.io event 'dependency:created' to workspace room
        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('dependency:created', { dependency });

        // 5. Enqueue BullMQ job 'critical-path-compute'
        await criticalPathQueue.add('critical-path-compute', { workspaceId });

        return dependency;
    }

    async removeDependency(workspaceId: string, dependencyId: string, userId: string) {
        // 1. Delete dependency (repo validates workspace scope)
        const deleted = await dependencyRepository.deleteDependency(dependencyId, workspaceId);
        
        if (!deleted) {
            throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Dependency not found or invalid workspace.' });
        }

        // 2. Emit 'dependency:deleted'
        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('dependency:deleted', { dependencyId });

        // 3. Enqueue 'critical-path-compute'
        await criticalPathQueue.add('critical-path-compute', { workspaceId });

        return true;
    }
}

export const dependencyService = new DependencyService();
