import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { taskDependencies, tasks } from '../db/schema';

export type NewDependency = typeof taskDependencies.$inferInsert;
export type Dependency = typeof taskDependencies.$inferSelect;

export class DependencyRepository {
    async createDependency(data: NewDependency): Promise<Dependency> {
        const [created] = await db.insert(taskDependencies).values(data).returning();
        return created;
    }

    async deleteDependency(id: string, workspaceId: string): Promise<boolean> {
        // Validate dependency logic ensuring it belongs to the parent workspace
        const [dependency] = await db
            .select({ id: taskDependencies.id })
            .from(taskDependencies)
            .innerJoin(tasks, eq(tasks.id, taskDependencies.predecessorTaskId))
            .where(and(
                eq(taskDependencies.id, id),
                eq(tasks.workspaceId, workspaceId)
            ))
            .limit(1);

        if (!dependency) return false;

        const result = await db.delete(taskDependencies).where(eq(taskDependencies.id, id)).returning({ id: taskDependencies.id });
        return result.length > 0;
    }

    async getDependenciesByTask(taskId: string): Promise<Dependency[]> {
        return await db
            .select()
            .from(taskDependencies)
            .where(
                or(
                    eq(taskDependencies.predecessorTaskId, taskId),
                    eq(taskDependencies.successorTaskId, taskId)
                )
            );
    }

    async getDependenciesByWorkspace(workspaceId: string): Promise<Dependency[]> {
        // Return all dependencies for all tasks within the workspace
        return await db
            .select({
                id: taskDependencies.id,
                predecessorTaskId: taskDependencies.predecessorTaskId,
                successorTaskId: taskDependencies.successorTaskId,
                dependencyType: taskDependencies.dependencyType,
                lagDays: taskDependencies.lagDays,
                createdBy: taskDependencies.createdBy,
                createdAt: taskDependencies.createdAt,
            })
            .from(taskDependencies)
            .innerJoin(tasks, eq(tasks.id, taskDependencies.predecessorTaskId))
            .where(eq(tasks.workspaceId, workspaceId));
    }

    /**
     * Recursive PostgreSQL CTE (Common Table Expression).
     * Tests if inserting a dependency linking predecessor -> successor
     * creates a circular loop wherein successor naturally loops back to predecessor.
     */
    async checkCircular(predecessorId: string, successorId: string): Promise<boolean> {
        // If they are directly equal, it's circular immediately.
        if (predecessorId === successorId) return true;

        const query = sql`
            WITH RECURSIVE search_graph AS (
                -- Base case: find what the successor directly blocks/leads to.
                SELECT successor_task_id
                FROM task_dependencies
                WHERE predecessor_task_id = ${successorId}
                
                UNION
                
                -- Recursive step: keep checking down the chain
                SELECT d.successor_task_id
                FROM task_dependencies d
                INNER JOIN search_graph sg ON d.predecessor_task_id = sg.successor_task_id
            )
            -- Check if we ever hit the new predecessor deep in the successor's downstream graph.
            SELECT successor_task_id 
            FROM search_graph 
            WHERE successor_task_id = ${predecessorId}
            LIMIT 1;
        `;

        const result = await db.execute(query);
        return (result.rowCount || 0) > 0;
    }
}

export const dependencyRepository = new DependencyRepository();
