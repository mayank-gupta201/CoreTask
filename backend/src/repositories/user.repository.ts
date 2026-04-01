import { eq } from 'drizzle-orm';
import { db } from '../db';
import { users } from '../db/schema';

export type NewUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UpdateUser = Partial<Omit<NewUser, 'id' | 'createdAt'>>;

export class UserRepository {
    async create(user: NewUser): Promise<User> {
        const [createdUser] = await db.insert(users).values(user).returning();
        return createdUser;
    }

    async findByEmail(email: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        return user;
    }

    async findByGoogleId(googleId: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
        return user;
    }

    async findByResetToken(token: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.resetPasswordToken, token)).limit(1);
        return user;
    }

    async findByVerificationToken(token: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.verificationToken, token)).limit(1);
        return user;
    }

    async findByRefreshToken(token: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.refreshToken, token)).limit(1);
        return user;
    }

    async findById(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
        return user;
    }

    async update(id: string, data: UpdateUser): Promise<User | undefined> {
        const [updatedUser] = await db
            .update(users)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(users.id, id))
            .returning();
        return updatedUser;
    }
}

export const userRepository = new UserRepository();
