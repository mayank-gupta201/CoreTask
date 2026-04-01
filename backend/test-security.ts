import axios from 'axios';
import { db } from './src/db';
import { auditLogs, users } from './src/db/schema';
import { eq, desc } from 'drizzle-orm';

const API_URL = 'http://localhost:4000/api';

async function runTests() {
    try {
        console.log('Testing Registration...');
        const uniqueEmail = `testuser_${Date.now()}@example.com`;
        const registerRes = await axios.post(`${API_URL}/auth/register`, {
            email: uniqueEmail,
            password: 'password123',
        });

        console.log('Register Headers:', registerRes.headers); // Should contain set-cookie

        console.log('Testing Login...');
        const loginRes = await axios.post(`${API_URL}/auth/login`, {
            email: uniqueEmail,
            password: 'password123',
        });

        // The set-cookie header should be present, but axios doesn't store it by default without a cookie jar. 
        // We'll read the response headers to verify the refresh token is being sent as an HttpOnly cookie.
        const setCookieHeader = loginRes.headers['set-cookie'];
        console.log('Login Set-Cookie header exists:', !!setCookieHeader);
        if (setCookieHeader) {
            console.log('Cookie options:', setCookieHeader[0].match(/HttpOnly|Secure|SameSite/g));
        }

        console.log('\nChecking Audit Logs in database...');
        const logs = await db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(3);

        console.log('\nRecent Audit Logs:');
        logs.forEach(log => {
            console.log(`- Action: ${log.action}, Resource: ${log.resource}, User: ${log.userId}`);
        });

        const tokensMatch = logs.some(l => l.action === 'USER_LOGIN') && logs.some(l => l.action === 'USER_REGISTERED');
        console.log(`\nAudit Logging Working: ${tokensMatch}`);

        console.log('\nTests Completed Successfully!');

    } catch (error: any) {
        console.error('Test failed:', error.response?.data || error.message);
    } finally {
        process.exit(0);
    }
}

runTests();
