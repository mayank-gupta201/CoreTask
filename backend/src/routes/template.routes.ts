import { Router } from 'express';
import {
    templateController,
    createTemplateSchema,
    templateIdSchema,
} from '../controllers/template.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { requireWorkspace } from '../middlewares/workspace.middleware';

export const templateRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

templateRouter.use(authenticate as any);
templateRouter.use(requireWorkspace as any);

templateRouter.get('/', asyncHandler(templateController.getTemplates));
templateRouter.post('/', validate(createTemplateSchema), asyncHandler(templateController.createTemplate));
templateRouter.get('/:id', validate(templateIdSchema), asyncHandler(templateController.getTemplate));
templateRouter.post('/apply/:id', validate(templateIdSchema), asyncHandler(templateController.applyTemplate));
templateRouter.delete('/:id', validate(templateIdSchema), asyncHandler(templateController.deleteTemplate));
