import { Response, NextFunction } from 'express';
import { taskService } from '../services/task.service';
import { aiService } from '../services/ai.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { ProblemDetails } from '../errors';

export const createTaskSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        dueDate: z.string().datetime().optional(),
        category: z.string().optional(),
        recurrenceRule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
        // Feature 1: Task Assignment
        assignedTo: z.string().uuid().optional().nullable(),
        // Feature 6: Subtasks
        parentTaskId: z.string().uuid().optional().nullable(),
    }),
});

export const updateTaskSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.string().optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
        dueDate: z.string().datetime().optional(),
        category: z.string().optional(),
        recurrenceRule: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional().nullable(),
        // Feature 1: Task Assignment
        assignedTo: z.string().uuid().optional().nullable(),
    }),
});

export const taskIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export const generateSubTasksSchema = z.object({
    body: z.object({
        goalContext: z.string().min(3),
    }),
});

export class TaskController {
    async getTasks(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            // Feature 5: Extract pagination & filter params from query string
            const filters = {
                cursor: req.query.cursor as string | undefined,
                limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 20,
                status: req.query.status as string | undefined,
                priority: req.query.priority as string | undefined,
                search: req.query.search as string | undefined,
                assignedTo: req.query.assignedTo as string | undefined,
                parentOnly: req.query.parentOnly !== 'false', // default true
            };
            const result = await taskService.getTasks(workspaceId, filters);
            return res.json(result);
        } catch (error) {
            next(error);
        }
    }

    async getTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const taskId = String(req.params.id);
            const task = await taskService.getTaskById(taskId, workspaceId);
            return res.json(task);
        } catch (error: any) {
            if (error.message === 'Task not found') {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: error.message }));
            }
            next(error);
        }
    }

    async createTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const workspaceId = req.workspace!.id;
            const task = await taskService.createTask(workspaceId, userId, req.body as {
                title: string;
                category?: string;
                assignedTo?: string | null;
                parentTaskId?: string | null;
            });
            return res.status(201).json(task);
        } catch (error) {
            next(error);
        }
    }

    async updateTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const taskId = String(req.params.id);
            const task = await taskService.updateTask(taskId, workspaceId, userId, req.body as {
                title?: string;
                status?: string;
                category?: string;
                priority?: string;
                assignedTo?: string | null;
            });
            return res.json(task);
        } catch (error: any) {
            if (error.message === 'Task not found') {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: error.message }));
            }
            next(error);
        }
    }

    async deleteTask(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const taskId = String(req.params.id);
            await taskService.deleteTask(taskId, workspaceId);
            return res.status(204).send();
        } catch (error: any) {
            if (error.message === 'Task not found') {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: error.message }));
            }
            next(error);
        }
    }

    async generateSubTasks(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { goalContext } = req.body;
            const subTasks = await aiService.breakdownTask(goalContext);
            return res.json({ subTasks });
        } catch (error) {
            next(error);
        }
    }

    // Feature 6: Get subtasks of a task
    async getSubtasks(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const parentId = String(req.params.id);
            const subtasks = await taskService.getSubtasks(parentId, workspaceId);
            return res.json(subtasks);
        } catch (error: any) {
            if (error.message === 'Task not found') {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: error.message }));
            }
            next(error);
        }
    }
}

export const taskController = new TaskController();
