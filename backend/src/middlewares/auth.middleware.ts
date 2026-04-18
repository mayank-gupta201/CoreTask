import { Request, Response, NextFunction } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import { ProblemDetails } from '../errors';
import { userRepository } from '../repositories/user.repository';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_please_change_in_prod';

export interface AuthRequest extends Request {
    user?: {
        userId: string;
    };
    workspace?: { id: string; role: string };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        
        // Ensure user actually exists in the DB
        const user = await userRepository.findById(payload.userId);
        if (!user) {
            return next(new ProblemDetails({ title: 'Unauthorized', status: 401, detail: 'User no longer exists' }));
        }

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
