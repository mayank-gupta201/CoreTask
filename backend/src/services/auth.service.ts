import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users, tasks, workspaces, workspaceMembers } from '../db/schema';
import { userRepository, NewUser } from '../repositories/user.repository';
import { eq } from 'drizzle-orm';
import { emailQueue } from '../queue';
import crypto from 'crypto';
import { auditService } from './audit.service';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkey_please_change_in_prod';
const REFRESH_SECRET = process.env.REFRESH_SECRET || 'superrefreshsecretkey_please_change_in_prod';

export class AuthService {
    async register(data: { email: string; passwordHash: string }) {
        const existing = await userRepository.findByEmail(data.email);
        if (existing) {
            throw new Error('User already exists');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.passwordHash, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');

        // ACID transaction: create user and default task
        const user = await db.transaction(async (tx) => {
            const [newUser] = await tx
                .insert(users)
                .values({
                    email: data.email,
                    passwordHash: hashedPassword,
                    verificationToken,
                })
                .returning();

            const [newWorkspace] = await tx.insert(workspaces).values({
                name: 'Personal Workspace',
                ownerId: newUser.id
            }).returning();

            await tx.insert(workspaceMembers).values({
                workspaceId: newWorkspace.id,
                userId: newUser.id,
                role: 'OWNER'
            });

            await tx.insert(tasks).values({
                title: 'Welcome to your Task Management System!',
                status: 'TODO',
                category: 'System',
                workspaceId: newWorkspace.id,
                userId: newUser.id,
            });

            return newUser;
        });

        // Enqueue email
        try {
            await emailQueue.add('sendEmail', {
                to: user.email,
                subject: 'Verify your TaskMaster account',
                type: 'VERIFY_EMAIL',
                payload: { token: verificationToken },
            });
        } catch (e) {
            console.error('Failed to enqueue email:', e);
        }

        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

        await userRepository.update(user.id, { refreshToken } as any);

        await auditService.logAction({
            userId: user.id,
            action: 'USER_REGISTERED',
            resource: 'Auth',
        });

        return { user: { id: user.id, email: user.email }, accessToken, refreshToken };
    }

    async verifyEmail(token: string) {
        const user = await userRepository.findByVerificationToken(token);
        if (!user) {
            throw new Error('Invalid or expired token');
        }
        await userRepository.update(user.id, { isEmailVerified: true, verificationToken: null } as any);

        await auditService.logAction({
            userId: user.id,
            action: 'EMAIL_VERIFIED',
            resource: 'Auth',
        });

        return true;
    }

    async forgotPassword(email: string) {
        const user = await userRepository.findByEmail(email);
        if (!user) return true; // Don't expose whether user exists

        const resetPasswordToken = crypto.randomBytes(32).toString('hex');
        const resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour

        await userRepository.update(user.id, { resetPasswordToken, resetPasswordExpires } as any);

        try {
            await emailQueue.add('sendEmail', {
                to: user.email,
                subject: 'Reset your password',
                type: 'RESET_PASSWORD',
                payload: { token: resetPasswordToken },
            });
        } catch (e) {
            console.error('Failed to enqueue password reset email:', e);
        }

        await auditService.logAction({
            userId: user.id,
            action: 'PASSWORD_RESET_REQUESTED',
            resource: 'Auth',
        });

        return true;
    }

    async resetPassword(token: string, newPassword: string) {
        const user = await userRepository.findByResetToken(token);
        if (!user || !user.resetPasswordExpires || new Date() > new Date(user.resetPasswordExpires)) {
            throw new Error('Invalid or expired token');
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await userRepository.update(user.id, {
            passwordHash: hashedPassword,
            resetPasswordToken: null,
            resetPasswordExpires: null
        } as any);

        await auditService.logAction({
            userId: user.id,
            action: 'PASSWORD_RESET_COMPLETED',
            resource: 'Auth',
        });

        return true;
    }

    async login(data: { email: string; passwordHash: string }) {
        const user = await userRepository.findByEmail(data.email);
        if (!user || !user.passwordHash) {
            throw new Error('Invalid credentials');
        }

        const isMatch = await bcrypt.compare(data.passwordHash, user.passwordHash);
        if (!isMatch) {
            await auditService.logAction({ action: 'FAILED_LOGIN', resource: 'Auth', metadata: { email: data.email } });
            throw new Error('Invalid credentials');
        }

        const accessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

        await userRepository.update(user.id, { refreshToken } as any);

        await auditService.logAction({ userId: user.id, action: 'USER_LOGIN', resource: 'Auth' });

        return { user: { id: user.id, email: user.email }, accessToken, refreshToken };
    }

    async googleLogin(profile: any) {
        const { id: googleId, emails } = profile;
        const email = emails[0].value;

        let user = await userRepository.findByGoogleId(googleId);

        if (!user) {
            // Check if user exists with the same email but no googleId
            user = await userRepository.findByEmail(email);
            if (user) {
                user = await userRepository.update(user.id, { googleId, isEmailVerified: true }) as any;
            } else {
                // ACID transaction: create user and default task
                user = await db.transaction(async (tx) => {
                    const [newUser] = await tx
                        .insert(users)
                        .values({
                            email,
                            googleId,
                            isEmailVerified: true, // Google verifies emails
                        })
                        .returning();

                    const [newWorkspace] = await tx.insert(workspaces).values({
                        name: 'Personal Workspace',
                        ownerId: newUser.id
                    }).returning();

                    await tx.insert(workspaceMembers).values({
                        workspaceId: newWorkspace.id,
                        userId: newUser.id,
                        role: 'OWNER'
                    });

                    await tx.insert(tasks).values({
                        title: 'Welcome to your Task Management System!',
                        status: 'TODO',
                        category: 'System',
                        workspaceId: newWorkspace.id,
                        userId: newUser.id,
                    });

                    return newUser;
                });
            }
        }

        const accessToken = jwt.sign({ userId: user!.id }, JWT_SECRET, { expiresIn: '15m' });
        const refreshToken = jwt.sign({ userId: user!.id }, REFRESH_SECRET, { expiresIn: '7d' });

        await userRepository.update(user!.id, { refreshToken } as any);
        await auditService.logAction({ userId: user!.id, action: 'GOOGLE_LOGIN', resource: 'Auth' });

        return { user: { id: user!.id, email: user!.email }, accessToken, refreshToken };
    }

    async refreshTokens(refreshToken: string) {
        if (!refreshToken) throw new Error('Refresh token strongly required');

        try {
            const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as any;
            const user = await userRepository.findById(decoded.userId);

            if (!user || user.refreshToken !== refreshToken) {
                throw new Error('Invalid refresh token');
            }

            const newAccessToken = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '15m' });
            const newRefreshToken = jwt.sign({ userId: user.id }, REFRESH_SECRET, { expiresIn: '7d' });

            await userRepository.update(user.id, { refreshToken: newRefreshToken } as any);
            await auditService.logAction({ userId: user.id, action: 'TOKEN_REFRESHED', resource: 'Auth' });

            return { accessToken: newAccessToken, refreshToken: newRefreshToken };
        } catch (error) {
            throw new Error('Invalid or expired refresh token');
        }
    }

    async logout(userId: string) {
        await userRepository.update(userId, { refreshToken: null } as any);
        await auditService.logAction({ userId, action: 'USER_LOGOUT', resource: 'Auth' });
        return true;
    }
}

export const authService = new AuthService();
