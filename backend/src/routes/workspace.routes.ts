import { Router } from 'express';
import { workspaceController, createWorkspaceSchema, inviteMemberSchema } from '../controllers/workspace.controller';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';

export const workspaceRouter = Router();

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

workspaceRouter.use(authenticate as any);

workspaceRouter.post('/', validate(createWorkspaceSchema), asyncHandler(workspaceController.createWorkspace));
workspaceRouter.get('/', asyncHandler(workspaceController.getWorkspaces));
workspaceRouter.post('/:id/invites', validate(inviteMemberSchema), asyncHandler(workspaceController.inviteMember));
// Feature 1: Get workspace members for task assignment
workspaceRouter.get('/:id/members', asyncHandler(workspaceController.getMembers));

