import { pool } from './index';

async function resetDb() {
    try {
        console.log('Resetting Database...');
        await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
        await pool.query('DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA drizzle;');
        console.log('Database reset complete.');
    } catch (err) {
        console.error('Failed to reset DB:', err);
    } finally {
        pool.end();
        process.exit(0);
    }
}

resetDb();
