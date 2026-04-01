import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing in environment variables');
}

export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

export const db = drizzle(pool, { schema, logger: process.env.NODE_ENV !== 'production' });
