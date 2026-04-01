import { db } from '../src/db';
import { users, tasks, workspaces, workspaceMembers } from '../src/db/schema';
import { eq, isNull } from 'drizzle-orm';

async function runMigration() {
    console.log('Starting workspace migration...');

    // 1. Find all users
    const allUsers = await db.select().from(users);
    console.log(`Found ${allUsers.length} users.`);

    for (const user of allUsers) {
        console.log(`Processing user: ${user.email}`);

        // 2. See if they already have a "Personal Workspace"
        const existingWorkspaces = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.id));

        let personalWorkspace;
        if (existingWorkspaces.length === 0) {
            // 3. Create a workspace for them
            console.log(`Creating Personal Workspace for ${user.email}`);
            const [newWorkspace] = await db.insert(workspaces).values({
                name: 'Personal Workspace',
                ownerId: user.id
            }).returning();
            personalWorkspace = newWorkspace;

            // 4. Add them as an OWNER to the workspace_members table
            await db.insert(workspaceMembers).values({
                workspaceId: personalWorkspace.id,
                userId: user.id,
                role: 'OWNER'
            });
        } else {
            personalWorkspace = existingWorkspaces[0];
            console.log(`Personal Workspace already exists for ${user.email} (ID: ${personalWorkspace.id})`);
        }

        // 5. Find all tasks for this user that DO NOT have a workspaceId
        const userTasks = await db.select().from(tasks).where(eq(tasks.userId, user.id));
        const orphanTasks = userTasks.filter(t => !t.workspaceId);

        if (orphanTasks.length > 0) {
            console.log(`Migrating ${orphanTasks.length} orphaned tasks for ${user.email} into Personal Workspace`);
            // 6. Update tasks to point to this new workspace
            for (const task of orphanTasks) {
                await db.update(tasks)
                    .set({ workspaceId: personalWorkspace.id })
                    .where(eq(tasks.id, task.id));
            }
        }
    }

    console.log('Workspace migration completed successfully!');
    process.exit(0);
}

runMigration().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
