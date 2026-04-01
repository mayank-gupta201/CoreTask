import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { z } from 'zod';
import { ProblemDetails } from '../errors';

export const authSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(6), // password instead of passwordHash for API
    }),
});

export const forgotPasswordSchema = z.object({
    body: z.object({
        email: z.string().email(),
    }),
});

export const resetPasswordSchema = z.object({
    params: z.object({
        token: z.string(),
    }),
    body: z.object({
        password: z.string().min(6),
    }),
});

export const verifyEmailSchema = z.object({
    params: z.object({
        token: z.string(),
    }),
});

const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' as const : 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
    async register(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;
            const result = await authService.register({ email, passwordHash: password });

            res.cookie('refreshToken', result.refreshToken, cookieOptions);
            return res.status(201).json({ user: result.user, token: result.accessToken });
        } catch (error: any) {
            if (error.message === 'User already exists') {
                return next(
                    new ProblemDetails({
                        title: 'Conflict',
                        status: 409,
                        detail: error.message,
                    })
                );
            }
            next(error);
        }
    }

    async login(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, password } = req.body;
            const result = await authService.login({ email, passwordHash: password });

            res.cookie('refreshToken', result.refreshToken, cookieOptions);
            return res.json({ user: result.user, token: result.accessToken });
        } catch (error: any) {
            if (error.message === 'Invalid credentials') {
                return next(
                    new ProblemDetails({
                        title: 'Unauthorized',
                        status: 401,
                        detail: error.message,
                    })
                );
            }
            next(error);
        }
    }

    async verifyEmail(req: Request, res: Response, next: NextFunction) {
        try {
            await authService.verifyEmail(req.params.token as string);
            return res.json({ message: 'Email verified successfully' });
        } catch (error: any) {
            if (error.message === 'Invalid or expired token') {
                return next(new ProblemDetails({ title: 'Bad Request', status: 400, detail: error.message }));
            }
            next(error);
        }
    }

    async forgotPassword(req: Request, res: Response, next: NextFunction) {
        try {
            await authService.forgotPassword(req.body.email);
            return res.json({ message: 'If that email exists, a reset link has been sent.' });
        } catch (error) {
            next(error);
        }
    }

    async resetPassword(req: Request, res: Response, next: NextFunction) {
        try {
            await authService.resetPassword(req.params.token as string, req.body.password);
            return res.json({ message: 'Password reset successfully' });
        } catch (error: any) {
            if (error.message === 'Invalid or expired token') {
                return next(new ProblemDetails({ title: 'Bad Request', status: 400, detail: error.message }));
            }
            next(error);
        }
    }

    async refresh(req: Request, res: Response, next: NextFunction) {
        try {
            const incomingToken = req.cookies?.refreshToken;
            if (!incomingToken) {
                return next(new ProblemDetails({ title: 'Unauthorized', status: 401, detail: 'Refresh token missing' }));
            }

            const { accessToken, refreshToken } = await authService.refreshTokens(incomingToken);

            res.cookie('refreshToken', refreshToken, cookieOptions);
            return res.json({ token: accessToken });
        } catch (error: any) {
            res.clearCookie('refreshToken');
            return next(new ProblemDetails({ title: 'Unauthorized', status: 401, detail: error.message }));
        }
    }

    async logout(req: Request, res: Response, next: NextFunction) {
        try {
            const userId = (req as any).user?.userId; // Set by auth middleware
            if (userId) {
                await authService.logout(userId);
            }
            res.clearCookie('refreshToken');
            return res.json({ message: 'Logged out successfully' });
        } catch (error: any) {
            next(error);
        }
    }
}

export const authController = new AuthController();
