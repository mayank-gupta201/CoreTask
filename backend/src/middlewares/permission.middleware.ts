import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.middleware';
import { ProblemDetails } from '../errors';
import { getRolePermissions, PermissionString } from '../config/permissions';

export const checkPermission = (requiredPermission: PermissionString) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.workspace || !req.workspace.role) {
            return next(new ProblemDetails({ 
                title: 'Forbidden', 
                status: 403, 
                detail: 'Workspace context missing' 
            }));
        }

        const role = req.workspace.role;
        const perms = getRolePermissions(role);

        if (!perms.includes(requiredPermission)) {
            return next(new ProblemDetails({ 
                title: 'Forbidden', 
                status: 403, 
                detail: `Role ${role} lacks permission: ${requiredPermission}` 
            }));
        }

        next();
    };
};
