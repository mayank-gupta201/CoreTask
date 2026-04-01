import { describe, it, expect } from 'vitest';
import { ProblemDetails } from '../src/errors';

describe('ProblemDetails Error Handler', () => {
    it('should instantiate correctly', () => {
        const error = new ProblemDetails({
            title: 'Not Found',
            status: 404,
            detail: 'Resource missing',
        });

        expect(error.status).toBe(404);
        expect(error.title).toBe('Not Found');
        expect(error.detail).toBe('Resource missing');
    });
});
