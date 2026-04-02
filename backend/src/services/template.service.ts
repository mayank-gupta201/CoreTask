import { db } from '../db';
import { tasks } from '../db/schema';
import { templateRepository, NewTemplate, NewTemplateItem } from '../repositories/template.repository';
import { getIO } from '../socket';

export class TemplateService {
    async createTemplate(
        workspaceId: string,
        createdBy: string,
        data: { name: string; description?: string; items: { title: string; description?: string; priority?: string; category?: string }[] }
    ) {
        const template = await templateRepository.create({
            name: data.name,
            description: data.description,
            workspaceId,
            createdBy,
        });

        const items: NewTemplateItem[] = data.items.map((item, index) => ({
            templateId: template.id,
            title: item.title,
            description: item.description,
            priority: item.priority || 'MEDIUM',
            category: item.category,
            sortOrder: index,
        }));

        const createdItems = await templateRepository.createItems(items);

        return { ...template, items: createdItems };
    }

    async getTemplates(workspaceId: string) {
        return await templateRepository.findByWorkspace(workspaceId);
    }

    async getTemplateWithItems(id: string) {
        return await templateRepository.findWithItems(id);
    }

    /**
     * Apply a template — bulk-inserts all template items as real tasks
     * within a single PostgreSQL ACID transaction.
     */
    async applyTemplate(templateId: string, workspaceId: string, userId: string) {
        const template = await templateRepository.findWithItems(templateId);
        if (!template) {
            throw new Error('Template not found');
        }

        const templateItems = template.items || [];
        if (templateItems.length === 0) {
            throw new Error('Template has no items');
        }

        // ACID Transaction: bulk-insert all tasks
        const createdTasks = await db.transaction(async (tx) => {
            const newTasks = [];
            for (const item of templateItems) {
                const [task] = await tx.insert(tasks).values({
                    title: item.title,
                    description: item.description,
                    status: 'TODO',
                    priority: item.priority,
                    category: item.category,
                    workspaceId,
                    userId,
                }).returning();
                newTasks.push(task);
            }
            return newTasks;
        });

        // Emit socket events for real-time updates
        try {
            const io = getIO();
            for (const task of createdTasks) {
                io.to(`workspace_${workspaceId}`).emit('taskCreated', task);
            }
        } catch (e) {
            // Socket may not be initialized
        }

        return { template: template.name, tasksCreated: createdTasks.length, tasks: createdTasks };
    }

    async deleteTemplate(id: string, workspaceId: string) {
        const success = await templateRepository.delete(id, workspaceId);
        if (!success) {
            throw new Error('Template not found');
        }
        return true;
    }
}

export const templateService = new TemplateService();
