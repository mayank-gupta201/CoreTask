import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index';

async function runMigrations() {
    try {
        console.log('Running database migrations...');
        await migrate(db, { migrationsFolder: 'src/db/migrations' });
        console.log('Migrations completed successfully.');
        pool.end();
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        pool.end();
        process.exit(1);
    }
}

runMigrations();
