import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { taskTemplates, templateItems } from '../db/schema';

export type NewTemplate = typeof taskTemplates.$inferInsert;
export type Template = typeof taskTemplates.$inferSelect;
export type NewTemplateItem = typeof templateItems.$inferInsert;
export type TemplateItem = typeof templateItems.$inferSelect;

export class TemplateRepository {
    async create(template: NewTemplate): Promise<Template> {
        const [created] = await db.insert(taskTemplates).values(template).returning();
        return created;
    }

    async createItems(items: NewTemplateItem[]): Promise<TemplateItem[]> {
        if (items.length === 0) return [];
        return await db.insert(templateItems).values(items).returning();
    }

    async findByWorkspace(workspaceId: string): Promise<Template[]> {
        return await db
            .select()
            .from(taskTemplates)
            .where(and(
                eq(taskTemplates.workspaceId, workspaceId),
                isNull(taskTemplates.deletedAt)   // Soft delete filter
            ));
    }

    async findById(id: string): Promise<Template | undefined> {
        const [template] = await db
            .select()
            .from(taskTemplates)
            .where(and(
                eq(taskTemplates.id, id),
                isNull(taskTemplates.deletedAt)   // Soft delete filter
            ))
            .limit(1);
        return template;
    }

    async findWithItems(id: string) {
        const template = await db.query.taskTemplates.findFirst({
            where: and(
                eq(taskTemplates.id, id),
                isNull(taskTemplates.deletedAt)   // Soft delete filter
            ),
            with: {
                items: true,
            },
        });
        return template;
    }

    // Feature 2: Soft delete — sets deletedAt instead of removing
    async delete(id: string, workspaceId: string): Promise<boolean> {
        const result = await db
            .update(taskTemplates)
            .set({ deletedAt: new Date() })
            .where(and(
                eq(taskTemplates.id, id),
                eq(taskTemplates.workspaceId, workspaceId),
                isNull(taskTemplates.deletedAt)
            ))
            .returning({ id: taskTemplates.id });
        return result.length > 0;
    }
}

export const templateRepository = new TemplateRepository();
