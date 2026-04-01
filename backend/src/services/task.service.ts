import { taskRepository, NewTask, UpdateTask, TaskFilters } from '../repositories/task.repository';
import { getIO } from '../socket';
import { db } from '../db';
import { taskActivities } from '../db/schema';
import { eq } from 'drizzle-orm';

export class TaskService {
    async createTask(workspaceId: string, userId: string, data: Omit<NewTask, 'userId' | 'workspaceId'>) {
        const task = await taskRepository.create({ ...data, userId, workspaceId });
        getIO().to(`workspace_${workspaceId}`).emit('taskCreated', task);
        return task;
    }

    async getTasks(workspaceId: string, filters?: TaskFilters) {
        return await taskRepository.findByWorkspace(workspaceId, filters);
    }

    async getTaskById(id: string, workspaceId: string) {
        const task = await taskRepository.findByIdAndWorkspace(id, workspaceId);
        if (!task) {
            throw new Error('Task not found');
        }
        return task;
    }

    async updateTask(id: string, workspaceId: string, userId: string, data: UpdateTask) {
        const existingTask = await taskRepository.findByIdAndWorkspace(id, workspaceId);
        if (!existingTask) {
            throw new Error('Task not found');
        }

        const task = await taskRepository.update(id, workspaceId, data);
        if (!task) {
            throw new Error('Task not found');
        }

        getIO().to(`workspace_${workspaceId}`).emit('taskUpdated', task);

        // Track Activity for Status Change
        if (data.status && existingTask.status !== data.status) {
            await this.trackActivity(id, userId, workspaceId, 'STATUS_CHANGE',
                `Status changed from ${existingTask.status} to ${data.status}`);
        }

        // Track Activity for Priority Change
        if (data.priority && existingTask.priority !== data.priority) {
            await this.trackActivity(id, userId, workspaceId, 'PRIORITY_CHANGE',
                `Priority changed from ${existingTask.priority} to ${data.priority}`);
        }

        // Feature 1: Track Activity for Assignment Change
        if (data.assignedTo !== undefined && existingTask.assignedTo !== data.assignedTo) {
            const content = data.assignedTo
                ? `Task assigned to user ${data.assignedTo}`
                : `Task unassigned`;
            await this.trackActivity(id, userId, workspaceId, 'ASSIGNMENT_CHANGE', content);
        }

        return task;
    }

    async deleteTask(id: string, workspaceId: string) {
        const success = await taskRepository.delete(id, workspaceId);
        if (!success) {
            throw new Error('Task not found');
        }
        getIO().to(`workspace_${workspaceId}`).emit('taskDeleted', { id, workspaceId });
        return true;
    }

    // Feature 6: Get subtasks of a parent task
    async getSubtasks(parentId: string, workspaceId: string) {
        // Verify parent exists
        const parentTask = await taskRepository.findByIdAndWorkspace(parentId, workspaceId);
        if (!parentTask) {
            throw new Error('Task not found');
        }
        return await taskRepository.findSubtasks(parentId, workspaceId);
    }

    // Feature 7: Update task by ID only (for webhook — no workspace context)
    async updateTaskById(taskId: string, data: UpdateTask) {
        // Find the task in any workspace
        const { tasks } = await import('../db/schema');
        const [task] = await db.select().from(tasks)
            .where(eq(tasks.id, taskId))
            .limit(1);
        if (!task) {
            throw new Error('Task not found');
        }
        const updated = await taskRepository.update(taskId, task.workspaceId, data);
        if (updated) {
            getIO().to(`workspace_${task.workspaceId}`).emit('taskUpdated', updated);
        }
        return updated;
    }

    // Helper: Create activity and emit socket event
    private async trackActivity(taskId: string, userId: string, workspaceId: string, type: string, content: string) {
        const [newActivity] = await db.insert(taskActivities).values({
            taskId,
            userId,
            type,
            content
        }).returning();

        const activityWithUser = await db.query.taskActivities.findFirst({
            where: eq(taskActivities.id, newActivity.id),
            with: {
                user: {
                    columns: {
                        id: true,
                        email: true,
                    }
                }
            }
        });

        if (activityWithUser) {
            getIO().to(`workspace_${workspaceId}`).emit('taskActivityCreated', { taskId, activity: activityWithUser });
        }
    }
}

export const taskService = new TaskService();
