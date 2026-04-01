import { Response, NextFunction } from 'express';
import { aiService } from '../services/ai.service';
import { taskService } from '../services/task.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';

export const chatMessageSchema = z.object({
    body: z.object({
        message: z.string().min(1).max(2000),
        history: z.array(z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
        })).max(50).optional().default([]),
    }),
});

export class ChatController {
    async chat(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const { message, history } = req.body;
            const userId = req.user!.userId;
            const workspaceId = req.workspace!.id;

            const result = await aiService.chat(message, history);

            // If AI created tasks, insert them into the database
            let createdTasks: any[] = [];
            if (result.tasks && result.tasks.length > 0) {
                for (const t of result.tasks) {
                    try {
                        const task = await taskService.createTask(workspaceId, userId, {
                            title: t.title,
                            priority: t.priority || 'MEDIUM',
                            category: t.category || 'AI Created',
                        });
                        createdTasks.push(task);
                    } catch (e) {
                        // Skip individual task creation failures
                    }
                }
            }

            return res.json({
                message: result.message,
                tasksCreated: createdTasks,
            });
        } catch (error) {
            next(error);
        }
    }
}

export const chatController = new ChatController();
