"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
(0, vitest_1.beforeAll)(() => {
    // Setup logic for tests, like connecting to test DB
    process.env.JWT_SECRET = 'test_secret';
});
(0, vitest_1.afterAll)(() => {
    // Cleanup logic
});
