import { Router } from 'express';
import { authController, authSchema, verifyEmailSchema, forgotPasswordSchema, resetPasswordSchema } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import passport from '../middlewares/passport.middleware';

export const authRouter = Router();

// Need wrapper for async errors if Express < 5, but let's use a simple wrapper
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next);

authRouter.post('/register', validate(authSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(authSchema), asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));

// Google OAuth routes
authRouter.get('/google', passport.authenticate('google', { session: false }));

authRouter.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: 'http://localhost:5173/login?error=oauth_failed' }),
    (req, res) => {
        // The Google Strategy passes { user, token } to req.user
        const { user, token } = req.user as any;
        res.redirect(`http://localhost:5173/login?token=${token}&userId=${user.id}&email=${encodeURIComponent(user.email)}`);
    }
);

authRouter.get('/verify-email/:token', validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));
authRouter.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRouter.post('/reset-password/:token', validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
