import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { workspaceService } from '../services/workspace.service';
import { ProblemDetails } from '../errors';

export const requireWorkspace = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const workspaceId = req.headers['x-workspace-id'] as string;

        if (!workspaceId) {
            return next(new ProblemDetails({ title: 'Bad Request', status: 400, detail: 'x-workspace-id header is required' }));
        }

        const userId = req.user!.userId;
        const membership = await workspaceService.verifyMembership(workspaceId, userId);

        if (!membership) {
            return next(new ProblemDetails({ title: 'Forbidden', status: 403, detail: 'You do not have access to this workspace' }));
        }

        req.workspace = { id: workspaceId, role: membership.role };
        next();
    } catch (err) {
        next(err);
    }
};

// Also augmenting the Express Request type globally
declare global {
    namespace Express {
        interface Request {
            workspace?: { id: string; role: string };
        }
    }
}
