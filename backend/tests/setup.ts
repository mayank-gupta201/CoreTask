import { beforeAll, afterAll } from 'vitest';

beforeAll(() => {
    // Setup logic for tests, like connecting to test DB
    process.env.JWT_SECRET = 'test_secret';
});

afterAll(() => {
    // Cleanup logic
});
