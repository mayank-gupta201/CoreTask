import axios from 'axios';
import { db } from './src/db';
import { users, workspaces } from './src/db/schema';
import { eq } from 'drizzle-orm';

const API_URL = 'http://localhost:4000/api';

async function verifyAITaskGeneration() {
    try {
        console.log('--- Commencing AI Task Breakdown Verification ---');

        // 1. Setup a test user and workspace directly in the database
        const uniqueEmail = `testuser_ai_${Date.now()}@example.com`;
        const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_please_change_in_prod';
        const hashedPassword = 'mock-password-hash';

        const [testUser] = await db.insert(users).values({
            email: uniqueEmail,
            passwordHash: hashedPassword,
        }).returning();

        const [testWorkspace] = await db.insert(workspaces).values({
            name: 'Test Workspace',
            ownerId: testUser.id
        }).returning();

        const workspaceId = testWorkspace.id;

        // Need to explicitly add the user as a member for the `requireWorkspace` auth middleware
        const { workspaceMembers } = require('./src/db/schema');
        await db.insert(workspaceMembers).values({
            workspaceId: workspaceId,
            userId: testUser.id,
            role: 'OWNER'
        });

        // 2. Mock a JWT access token for API authorization
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId: testUser.id }, jwtSecret, { expiresIn: '1m' });

        // 3. Ask the AI to break down a goal
        console.log('\nPrompting AI: "Plan a trip to Paris"');
        const aiResponse = await axios.post(`${API_URL}/tasks/ai-breakdown`, {
            goalContext: 'Plan a trip to Paris'
        }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'x-workspace-id': workspaceId
            }
        });

        const subTasks = aiResponse.data.subTasks;
        console.log(`\nAI Generated ${subTasks.length} tasks successfully!`);

        // Print the tasks to verify their JSON structure
        subTasks.forEach((task: any, index: number) => {
            console.log(`${index + 1}. [${task.priority}] ${task.title} (Category: ${task.category})`);
        });

        const isArray = Array.isArray(subTasks);
        const hasValidFormat = subTasks.every((t: any) => t.title && t.priority);

        console.log(`\nVerification Status:`);
        console.log(`- Returns Array: ${isArray ? '✅' : '❌'}`);
        console.log(`- Valid Task Format: ${hasValidFormat ? '✅' : '❌'}`);
        console.log(`- Minimum Tasks Generated (>2): ${subTasks.length > 2 ? '✅' : '❌'}`);

    } catch (error: any) {
        console.error('\n❌ Verification Failed:');
        if (error.response) {
            console.error('API Error Status:', error.response.status);
            console.error('API Error Data:', JSON.stringify(error.response.data, null, 2));
            console.error('API Error Headers:', error.response.headers);
        } else {
            console.error('Error Details:', error.message);
        }
    } finally {
        process.exit(0);
    }
}

verifyAITaskGeneration();
