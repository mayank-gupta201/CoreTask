import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor, paginateQuery, paginationSchema } from '../src/utils/pagination';

describe('Pagination Utility', () => {

    describe('encodeCursor / decodeCursor', () => {
        it('should encode and decode a cursor round-trip', () => {
            const id = '550e8400-e29b-41d4-a716-446655440000';
            const createdAt = new Date('2026-01-15T10:30:00Z');
            
            const cursor = encodeCursor(id, createdAt);
            expect(typeof cursor).toBe('string');
            expect(cursor.length).toBeGreaterThan(0);

            const decoded = decodeCursor(cursor);
            expect(decoded).not.toBeNull();
            expect(decoded!.id).toBe(id);
            expect(decoded!.created_at.toISOString()).toBe(createdAt.toISOString());
        });

        it('should encode with string date', () => {
            const id = 'test-id';
            const dateStr = '2026-03-10T12:00:00.000Z';
            const cursor = encodeCursor(id, dateStr);
            const decoded = decodeCursor(cursor);
            expect(decoded!.id).toBe(id);
            expect(decoded!.created_at.toISOString()).toBe(dateStr);
        });

        it('should return null for invalid cursor', () => {
            expect(decodeCursor('not-valid-base64!!!')).toBeNull();
            expect(decodeCursor('')).toBeNull();
        });

        it('should return null for valid base64 but invalid JSON', () => {
            const cursor = Buffer.from('not json').toString('base64');
            expect(decodeCursor(cursor)).toBeNull();
        });

        it('should return null for JSON without required fields', () => {
            const cursor = Buffer.from(JSON.stringify({ foo: 'bar' })).toString('base64');
            expect(decodeCursor(cursor)).toBeNull();
        });
    });

    describe('paginateQuery', () => {
        const makeItems = (count: number) => 
            Array.from({ length: count }, (_, i) => ({
                id: `item-${i}`,
                title: `Item ${i}`,
                createdAt: new Date(2026, 0, i + 1),
            }));

        it('should return all items when count <= limit', () => {
            const items = makeItems(5);
            const result = paginateQuery(items, 10);
            expect(result.items.length).toBe(5);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
        });

        it('should paginate when count > limit', () => {
            const items = makeItems(11); // limit + 1
            const result = paginateQuery(items, 10);
            expect(result.items.length).toBe(10);
            expect(result.hasMore).toBe(true);
            expect(result.nextCursor).not.toBeNull();
        });

        it('should not paginate when count === limit', () => {
            const items = makeItems(10);
            const result = paginateQuery(items, 10);
            expect(result.items.length).toBe(10);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
        });

        it('should handle empty array', () => {
            const result = paginateQuery([], 10);
            expect(result.items.length).toBe(0);
            expect(result.hasMore).toBe(false);
            expect(result.nextCursor).toBeNull();
        });

        it('should handle single item', () => {
            const items = makeItems(1);
            const result = paginateQuery(items, 10);
            expect(result.items.length).toBe(1);
            expect(result.hasMore).toBe(false);
        });

        it('should use the last item for nextCursor', () => {
            const items = makeItems(6); // limit(5) + 1
            const result = paginateQuery(items, 5);
            const decoded = decodeCursor(result.nextCursor!);
            expect(decoded!.id).toBe('item-4'); // Last item after removing extra
        });
    });

    describe('paginationSchema', () => {
        it('should parse valid query params', () => {
            const result = paginationSchema.parse({ limit: 20, cursor: 'abc123' });
            expect(result.limit).toBe(20);
            expect(result.cursor).toBe('abc123');
        });

        it('should use default limit of 20', () => {
            const result = paginationSchema.parse({});
            expect(result.limit).toBe(20);
        });

        it('should coerce string limit to number', () => {
            const result = paginationSchema.parse({ limit: '50' });
            expect(result.limit).toBe(50);
        });

        it('should reject limit > 100', () => {
            expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
        });

        it('should reject limit < 1', () => {
            expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
        });

        it('should allow optional cursor', () => {
            const result = paginationSchema.parse({});
            expect(result.cursor).toBeUndefined();
        });
    });
});
