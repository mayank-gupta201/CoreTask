const uniqueEmail = `testuser_ai_${Date.now()}@example.com`;
const jwtSecret = process.env.JWT_SECRET || 'supersecretjwtkey_please_change_in_prod';
const jwt = require('jsonwebtoken');

// A hardcoded mock user UUID for JWT creation.
// Usually we'd want this user/workspace to exist in the database for relations to work,
// but let's test the route middleware and controller first.
const mockUserId = '11111111-1111-1111-1111-111111111111';
const mockWorkspaceId = '22222222-2222-2222-2222-222222222222';

const token = jwt.sign({ userId: mockUserId }, jwtSecret, { expiresIn: '15m' });

async function run() {
    console.log('Fetching AI Breakdown...');
    try {
        const response = await fetch('http://localhost:4000/api/tasks/ai-breakdown', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-workspace-id': mockWorkspaceId,
            },
            body: JSON.stringify({ goalContext: 'Write a novel' }),
        });

        const text = await response.text();
        console.log(`Status: ${response.status}`);
        try {
            console.log(`Body:`, JSON.stringify(JSON.parse(text), null, 2));
        } catch {
            console.log(`Body:`, text);
        }
    } catch (e) {
        console.error('Fetch crashed:', e);
    }
}

run();
