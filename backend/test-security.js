const http = require('http');

const options = {
    hostname: 'localhost',
    port: 4000,
    path: '/api/auth/register',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
};

const uniqueEmail = `testuser_${Date.now()}@example.com`;
const reqData = JSON.stringify({ email: uniqueEmail, password: 'password123' });

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    const cookies = res.headers['set-cookie'];
    console.log('HEADERS Set-Cookie:', !!cookies);
    if (cookies) {
        console.log('Includes HttpOnly:', cookies[0].includes('HttpOnly'));
    }

    res.on('data', (chunk) => {
        console.log(`BODY: ${chunk}`);
    });
    res.on('end', () => {
        console.log('No more data in response.');

        // Now trigger a refresh
        const refreshOptions = {
            hostname: 'localhost',
            port: 4000,
            path: '/api/auth/refresh',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': cookies[0] // Pass back the refresh token
            }
        }
        const refreshReq = http.request(refreshOptions, (refRes) => {
            console.log(`\nREFRESH STATUS: ${refRes.statusCode}`);
            refRes.on('data', (d) => console.log(`REFRESH BODY: ${d}`));
        });
        refreshReq.end();

    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(reqData);
req.end();
