import { Request, Response, NextFunction } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import { ProblemDetails } from '../errors';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_please_change_in_prod';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
    };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(
            new ProblemDetails({
                title: 'Unauthorized',
                status: 401,
                detail: 'Missing or invalid authorization header',
            })
        );
    }

    const token = authHeader.split(' ')[1];

    try {
        const payload = jsonwebtoken.verify(token, JWT_SECRET) as { userId: string };
        req.user = payload;
        next();
    } catch (err) {
        return next(
            new ProblemDetails({
                title: 'Unauthorized',
                status: 401,
                detail: 'Invalid or expired token',
            })
        );
    }
};
