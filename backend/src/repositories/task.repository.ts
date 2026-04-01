import { eq, and, isNull, lt, desc, ilike, or, sql, SQL } from 'drizzle-orm';
import { db } from '../db';
import { tasks } from '../db/schema';

export type NewTask = typeof tasks.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type UpdateTask = Partial<Omit<NewTask, 'id' | 'userId' | 'createdAt'>>;

export interface TaskFilters {
    cursor?: string;       // ISO timestamp for cursor-based pagination
    limit?: number;        // Page size (default 20)
    status?: string;       // Filter by status
    priority?: string;     // Filter by priority
    search?: string;       // Search in title/description
    assignedTo?: string;   // Filter by assigned user
    parentOnly?: boolean;  // Only top-level tasks (no subtasks) — default true
}

export interface PaginatedResult<T> {
    items: T[];
    nextCursor: string | null;
    total: number;
}

export class TaskRepository {
    async create(task: NewTask): Promise<Task> {
        const [created] = await db.insert(tasks).values(task).returning();
        return created;
    }

    async findByWorkspace(workspaceId: string, filters: TaskFilters = {}): Promise<PaginatedResult<Task>> {
        const {
            cursor,
            limit = 20,
            status,
            priority,
            search,
            assignedTo,
            parentOnly = true,
        } = filters;

        // Build WHERE conditions
        const conditions: SQL[] = [
            eq(tasks.workspaceId, workspaceId),
            isNull(tasks.deletedAt),   // Soft delete filter
        ];

        // Top-level tasks only (exclude subtasks from main list)
        if (parentOnly) {
            conditions.push(isNull(tasks.parentTaskId));
        }

        if (status) {
            conditions.push(eq(tasks.status, status));
        }
        if (priority) {
            conditions.push(eq(tasks.priority, priority));
        }
        if (assignedTo) {
            conditions.push(eq(tasks.assignedTo, assignedTo));
        }
        if (search) {
            conditions.push(
                or(
                    ilike(tasks.title, `%${search}%`),
                    ilike(tasks.description, `%${search}%`)
                )!
            );
        }
        if (cursor) {
            conditions.push(lt(tasks.createdAt, new Date(cursor)));
        }

        // Get total count (without cursor/limit — for UI display)
        const countConditions = conditions.filter((_, i) => {
            // Remove the cursor condition from count query
            return !cursor || i !== conditions.length - 1;
        });
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(tasks)
            .where(and(...countConditions));

        // Get items
        const items = await db
            .select()
            .from(tasks)
            .where(and(...conditions))
            .orderBy(desc(tasks.createdAt))
            .limit(limit + 1); // Fetch one extra to check if there's a next page

        let nextCursor: string | null = null;
        if (items.length > limit) {
            items.pop(); // Remove the extra item
            nextCursor = items[items.length - 1].createdAt.toISOString();
        }

        return { items, nextCursor, total: count };
    }

    async findByIdAndWorkspace(id: string, workspaceId: string): Promise<Task | undefined> {
        const [task] = await db
            .select()
            .from(tasks)
            .where(and(
                eq(tasks.id, id),
                eq(tasks.workspaceId, workspaceId),
                isNull(tasks.deletedAt)   // Soft delete filter
            ))
            .limit(1);
        return task;
    }

    async update(id: string, workspaceId: string, data: UpdateTask): Promise<Task | undefined> {
        const [updated] = await db
            .update(tasks)
            .set({ ...data, updatedAt: new Date() })
            .where(and(
                eq(tasks.id, id),
                eq(tasks.workspaceId, workspaceId),
                isNull(tasks.deletedAt)   // Can't update deleted tasks
            ))
            .returning();
        return updated;
    }

    // Feature 2: Soft delete — sets deletedAt instead of removing the row
    async delete(id: string, workspaceId: string): Promise<boolean> {
        const result = await db
            .update(tasks)
            .set({ deletedAt: new Date() })
            .where(and(
                eq(tasks.id, id),
                eq(tasks.workspaceId, workspaceId),
                isNull(tasks.deletedAt)
            ))
            .returning({ id: tasks.id });
        return result.length > 0;
    }

    // Feature 6: Find subtasks of a parent task
    async findSubtasks(parentId: string, workspaceId: string): Promise<Task[]> {
        return await db
            .select()
            .from(tasks)
            .where(and(
                eq(tasks.parentTaskId, parentId),
                eq(tasks.workspaceId, workspaceId),
                isNull(tasks.deletedAt)
            ))
            .orderBy(desc(tasks.createdAt));
    }

    // Feature 6: Count subtasks for a parent
    async countSubtasks(parentId: string): Promise<number> {
        const [{ count }] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(tasks)
            .where(and(
                eq(tasks.parentTaskId, parentId),
                isNull(tasks.deletedAt)
            ));
        return count;
    }
}

export const taskRepository = new TaskRepository();
