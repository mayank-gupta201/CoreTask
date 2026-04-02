import { Response } from 'express';
import { dependencyService } from '../services/dependency.service';
import { taskService } from '../services/task.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

export const addDependencySchema = z.object({
    body: z.object({
        successorTaskId: z.string().uuid(),
        dependencyType: z.enum(['FS', 'SS', 'FF', 'SF']).default('FS'),
        lagDays: z.number().optional().default(0),
    }),
});

export class DependencyController {
    async addDependency(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const predecessorTaskId = req.params.taskId as string;
            const { successorTaskId, dependencyType, lagDays } = req.body;

            const dependency = await dependencyService.addDependency(
                workspaceId, 
                userId, 
                { predecessorTaskId, successorTaskId, dependencyType, lagDays }
            );

            res.status(201).json(dependency);
        } catch (error: any) {
            if (error.status) {
                res.status(error.status).json({ message: error.detail || error.message });
            } else {
                res.status(500).json({ message: error.message });
            }
        }
    }

    async removeDependency(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const dependencyId = req.params.dependencyId as string;

            await dependencyService.removeDependency(workspaceId, dependencyId, userId);
            res.status(204).send();
        } catch (error: any) {
            if (error.status) {
                res.status(error.status).json({ message: error.detail || error.message });
            } else {
                res.status(500).json({ message: error.message });
            }
        }
    }

    // Dashboard Data
    async getGanttData(req: AuthRequest, res: Response) {
        try {
            const workspaceId = req.workspace!.id;
            const ganttData = await taskService.getGanttData(workspaceId);
            res.json(ganttData);
        } catch (error: any) {
            res.status(500).json({ message: error.message });
        }
    }
}

export const dependencyController = new DependencyController();
