import { resourceRepository } from '../repositories/resource.repository';
import { db } from '../db';
import { tasks, workspaceMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { ProblemDetails } from '../errors';
import { getIO } from '../socket';
import { utilizationQueue } from '../queue';
import { cacheService, CacheService } from './cache.service';

export class ResourceService {
    async assignUserToTask(workspaceId: string, taskId: string, userId: string, allocationPercent: number, requesterId: string) {
        // 1. Verify task belongs to workspace
        const [task] = await db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId))).limit(1);
        if (!task) {
            throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Task does not exist in this workspace.' });
        }

        // 2. Verify userId is a member of workspace
        const [member] = await db.select({ userId: workspaceMembers.userId }).from(workspaceMembers).where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId))).limit(1);
        if (!member) {
            throw new ProblemDetails({ status: 400, title: 'Bad Request', detail: 'Assigned user must be a member of the workspace.' });
        }

        // 3. Create task_assignment row
        const assignment = await resourceRepository.assignUserToTask(taskId, userId, allocationPercent, requesterId);

        // 4. Recalculate utilization (background job)
        await utilizationQueue.add('utilization-calc', { userId, workspaceId });

        // 5. Emit Socket.io 'assignment:created'
        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('assignment:created', { taskId, userId, allocationPercent });

        // Note: rule 6 "If new utilization > 100% on any day: emit 'resource:overallocated'" is handled natively by the utilizationWorker to ensure accuracy 

        // Invalidate caching
        await cacheService.invalidatePattern(`dashboard:workspace:${workspaceId}*`);
        await cacheService.invalidate(CacheService.keys.resourceGrid(workspaceId, '')); // Will invalidate grid cache pattern correctly in controller mapping usually
        
        return assignment;
    }

    async removeAssignment(workspaceId: string, taskId: string, userId: string, requesterId: string) {
        const deleted = await resourceRepository.removeAssignment(taskId, userId);
        if (!deleted) {
            throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Assignment not found.' });
        }

        await utilizationQueue.add('utilization-calc', { userId, workspaceId });
        
        const io = getIO();
        io.to(`workspace_${workspaceId}`).emit('assignment:removed', { taskId, userId });

        await cacheService.invalidatePattern(`dashboard:workspace:${workspaceId}*`);

        return true;
    }

    async getResourceGrid(workspaceId: string, dateFrom: Date, dateTo: Date) {
        const dFromStr = dateFrom.toISOString().split('T')[0];
        const dToStr = dateTo.toISOString().split('T')[0];
        const cacheKey = CacheService.keys.resourceGrid(workspaceId, `${dFromStr}:${dToStr}`);

        return await cacheService.getOrSet(
            cacheKey,
            async () => {
                return await resourceRepository.getResourceGridData(workspaceId, dateFrom, dateTo);
            },
            120 // 120s TTL
        );
    }

    async setAvailability(workspaceId: string, userId: string, data: { availableHoursPerDay: number, effectiveFrom: Date, effectiveTo?: Date }, requesterId: string) {
        const record = await resourceRepository.setAvailability(userId, workspaceId, data.availableHoursPerDay, data.effectiveFrom, data.effectiveTo);
        
        // Changing availability impacts utilization caps -> recalcs overallocations potentially
        await utilizationQueue.add('utilization-calc', { userId, workspaceId });

        return record;
    }

    async manageHolidays(workspaceId: string, action: 'create' | 'delete', data: any, requesterId: string) {
        if (action === 'create') {
            const { name, date, isRecurring, region } = data;
            const res = await resourceRepository.createHoliday(workspaceId, name, date, isRecurring, requesterId, region);
            await cacheService.invalidatePattern(`resource-grid:${workspaceId}*`);
            return res;
        } else if (action === 'delete') {
            const res = await resourceRepository.deleteHoliday(data.holidayId, workspaceId);
            if (!res) throw new ProblemDetails({ status: 404, title: 'Not Found', detail: 'Holiday not found.' });
            
            await cacheService.invalidatePattern(`resource-grid:${workspaceId}*`);
            return true;
        }
    }

    async setUserCostRate(workspaceId: string, userId: string, data: { hourlyRate: number, currency: string, effectiveFrom: Date }, requesterId: string) {
        return await resourceRepository.setUserCostRate(userId, workspaceId, data.hourlyRate, data.currency, data.effectiveFrom);
    }
}

export const resourceService = new ResourceService();
