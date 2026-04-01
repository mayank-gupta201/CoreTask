import { Request, Response } from 'express';
import { db } from '../db';
import { taskActivities, tasks } from '../db/schema';
import { eq, desc, lt, and, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getIO } from '../socket';
import { ProblemDetails } from '../errors';
import { AuthRequest } from '../middlewares/auth.middleware';

export const commentSchema = z.object({
    body: z.object({
        content: z.string().min(1, 'Comment cannot be empty').max(2000),
    }),
});

export const taskIdSchema = z.object({
    params: z.object({
        id: z.string().uuid('Invalid task ID format'),
    }),
});

export class TaskActivityController {
    async getActivities(req: AuthRequest, res: Response) {
        const taskId = req.params.id as string;

        // Feature 5: Cursor-based pagination for activities
        const cursor = req.query.cursor as string | undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;

        const conditions = [
            eq(taskActivities.taskId, taskId),
            isNull(taskActivities.deletedAt),   // Soft delete filter
        ];

        if (cursor) {
            conditions.push(lt(taskActivities.createdAt, new Date(cursor)));
        }

        // Get total count (without cursor)
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(taskActivities)
            .where(and(
                eq(taskActivities.taskId, taskId),
                isNull(taskActivities.deletedAt)
            ));

        const activities = await db.query.taskActivities.findMany({
            where: and(...conditions),
            orderBy: [desc(taskActivities.createdAt)],
            limit: limit + 1, // Fetch one extra for next cursor
            with: {
                user: {
                    columns: {
                        id: true,
                        email: true,
                    }
                }
            }
        });

        let nextCursor: string | null = null;
        if (activities.length > limit) {
            activities.pop();
            nextCursor = activities[activities.length - 1].createdAt.toISOString();
        }

        res.json({
            items: activities,
            nextCursor,
            total: count,
        });
    }

    async addComment(req: AuthRequest, res: Response) {
        const taskId = req.params.id as string;
        const { content } = req.body;
        const userId = req.user!.userId;

        // Verify task exists (with soft delete filter)
        const taskMatches = await db.query.tasks.findMany({
            where: and(
                eq(tasks.id, taskId),
                isNull(tasks.deletedAt)   // Soft delete filter
            ),
            limit: 1
        });

        if (taskMatches.length === 0) {
            throw new ProblemDetails({
                type: 'not-found',
                title: 'Task Not Found',
                status: 404,
                detail: 'The requested task does not exist.',
            });
        }

        const task = taskMatches[0];

        const [newComment] = await db.insert(taskActivities).values({
            taskId,
            userId,
            type: 'COMMENT',
            content,
        }).returning();

        // fetch with user details to send out
        const commentWithUser = await db.query.taskActivities.findFirst({
            where: eq(taskActivities.id, newComment.id),
            with: {
                user: {
                    columns: {
                        id: true,
                        email: true,
                    }
                }
            }
        });

        getIO().to(`workspace_${task.workspaceId}`).emit('taskActivityCreated', { taskId, activity: commentWithUser });

        res.status(201).json(commentWithUser);
    }
}

export const taskActivityController = new TaskActivityController();
