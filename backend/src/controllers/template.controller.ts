import { Response, NextFunction } from 'express';
import { templateService } from '../services/template.service';
import { AuthRequest } from '../middlewares/auth.middleware';
import { z } from 'zod';
import { ProblemDetails } from '../errors';

export const createTemplateSchema = z.object({
    body: z.object({
        name: z.string().min(1, 'Template name is required'),
        description: z.string().optional(),
        items: z.array(z.object({
            title: z.string().min(1, 'Item title is required'),
            description: z.string().optional(),
            priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
            category: z.string().optional(),
        })).min(1, 'At least one item is required'),
    }),
});

export const templateIdSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
});

export class TemplateController {
    async getTemplates(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const templates = await templateService.getTemplates(workspaceId);
            return res.json(templates);
        } catch (error) {
            next(error);
        }
    }

    async getTemplate(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const id = req.params.id as string;
            const template = await templateService.getTemplateWithItems(id);
            if (!template) {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: 'Template not found' }));
            }
            return res.json(template);
        } catch (error) {
            next(error);
        }
    }

    async createTemplate(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const template = await templateService.createTemplate(workspaceId, userId, req.body);
            return res.status(201).json(template);
        } catch (error) {
            next(error);
        }
    }

    async applyTemplate(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const userId = req.user!.userId;
            const templateId = req.params.id as string;
            const result = await templateService.applyTemplate(templateId, workspaceId, userId);
            return res.status(201).json(result);
        } catch (error: any) {
            if (error.message === 'Template not found' || error.message === 'Template has no items') {
                return next(new ProblemDetails({ title: 'Bad Request', status: 400, detail: error.message }));
            }
            next(error);
        }
    }

    async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.workspace!.id;
            const templateId = req.params.id as string;
            await templateService.deleteTemplate(templateId, workspaceId);
            return res.status(204).send();
        } catch (error: any) {
            if (error.message === 'Template not found') {
                return next(new ProblemDetails({ title: 'Not Found', status: 404, detail: error.message }));
            }
            next(error);
        }
    }
}

export const templateController = new TemplateController();
