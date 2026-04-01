import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import { workspaces, workspaceMembers, users } from '../db/schema';

export type NewWorkspace = typeof workspaces.$inferInsert;
export type Workspace = typeof workspaces.$inferSelect;

export class WorkspaceRepository {
    async create(data: { name: string; ownerId: string }): Promise<Workspace> {
        return await db.transaction(async (tx) => {
            const [workspace] = await tx.insert(workspaces).values(data).returning();

            await tx.insert(workspaceMembers).values({
                workspaceId: workspace.id,
                userId: data.ownerId,
                role: 'OWNER'
            });

            return workspace;
        });
    }

    async findByUserId(userId: string): Promise<Workspace[]> {
        const results = await db
            .select({
                id: workspaces.id,
                name: workspaces.name,
                ownerId: workspaces.ownerId,
                createdAt: workspaces.createdAt,
                updatedAt: workspaces.updatedAt,
            })
            .from(workspaces)
            .innerJoin(workspaceMembers, eq(workspaces.id, workspaceMembers.workspaceId))
            .where(eq(workspaceMembers.userId, userId));

        return results;
    }

    async checkMembership(workspaceId: string, userId: string) {
        const [membership] = await db
            .select()
            .from(workspaceMembers)
            .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
            .limit(1);
        return membership;
    }

    async addMember(workspaceId: string, userId: string, role: string = 'MEMBER') {
        const [member] = await db.insert(workspaceMembers).values({
            workspaceId,
            userId,
            role,
        }).returning();
        return member;
    }

    // Feature 1: Get all members for task assignment dropdown
    async getMembers(workspaceId: string) {
        return await db
            .select({
                userId: users.id,
                email: users.email,
                role: workspaceMembers.role,
            })
            .from(workspaceMembers)
            .innerJoin(users, eq(workspaceMembers.userId, users.id))
            .where(eq(workspaceMembers.workspaceId, workspaceId));
    }
}

export const workspaceRepository = new WorkspaceRepository();
