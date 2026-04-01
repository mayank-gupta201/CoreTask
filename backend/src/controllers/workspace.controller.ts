import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middlewares/auth.middleware';
import { workspaceService } from '../services/workspace.service';
import { z } from 'zod';

export const createWorkspaceSchema = z.object({
    body: z.object({
        name: z.string().min(1),
    }),
});

export const inviteMemberSchema = z.object({
    params: z.object({
        id: z.string().uuid(),
    }),
    body: z.object({
        email: z.string().email(),
    }),
});

export class WorkspaceController {
    async createWorkspace(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const { name } = req.body;
            const workspace = await workspaceService.createWorkspace(userId, name);
            return res.status(201).json(workspace);
        } catch (error) {
            next(error);
        }
    }

    async getWorkspaces(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const userId = req.user!.userId;
            const workspaces = await workspaceService.getUserWorkspaces(userId);
            return res.json(workspaces);
        } catch (error) {
            next(error);
        }
    }

    async inviteMember(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const inviterId = req.user!.userId;
            const workspaceId = req.params.id as string;
            const { email } = req.body;
            const result = await workspaceService.inviteMember(workspaceId, inviterId, email);
            return res.json(result);
        } catch (error) {
            next(error);
        }
    }

    // Feature 1: Get workspace members for task assignment dropdown
    async getMembers(req: AuthRequest, res: Response, next: NextFunction) {
        try {
            const workspaceId = req.params.id as string;
            const members = await workspaceService.getWorkspaceMembers(workspaceId);
            return res.json(members);
        } catch (error) {
            next(error);
        }
    }
}

export const workspaceController = new WorkspaceController();
