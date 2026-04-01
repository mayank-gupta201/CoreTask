import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { taskAttachments } from '../db/schema';

export type NewAttachment = typeof taskAttachments.$inferInsert;
export type Attachment = typeof taskAttachments.$inferSelect;

export class AttachmentRepository {
    async create(data: NewAttachment): Promise<Attachment> {
        const [created] = await db.insert(taskAttachments).values(data).returning();
        return created;
    }

    async findByTaskId(taskId: string): Promise<Attachment[]> {
        return await db
            .select()
            .from(taskAttachments)
            .where(and(
                eq(taskAttachments.taskId, taskId),
                isNull(taskAttachments.deletedAt)   // Soft delete filter
            ));
    }

    async findById(id: string): Promise<Attachment | undefined> {
        const [attachment] = await db
            .select()
            .from(taskAttachments)
            .where(and(
                eq(taskAttachments.id, id),
                isNull(taskAttachments.deletedAt)   // Soft delete filter
            ))
            .limit(1);
        return attachment;
    }

    // Feature 2: Soft delete
    async delete(id: string, taskId: string): Promise<boolean> {
        const result = await db
            .update(taskAttachments)
            .set({ deletedAt: new Date() })
            .where(and(
                eq(taskAttachments.id, id),
                eq(taskAttachments.taskId, taskId),
                isNull(taskAttachments.deletedAt)
            ))
            .returning({ id: taskAttachments.id });
        return result.length > 0;
    }
}

export const attachmentRepository = new AttachmentRepository();
