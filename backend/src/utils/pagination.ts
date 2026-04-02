import { z } from 'zod';

export const paginationSchema = z.object({
    limit: z.coerce.number().min(1).max(100).default(20),
    cursor: z.string().optional()
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

export function encodeCursor(id: string, createdAt: Date | string): string {
    const timeStr = createdAt instanceof Date ? createdAt.toISOString() : createdAt;
    const payload = JSON.stringify({ id, created_at: timeStr });
    return Buffer.from(payload).toString('base64');
}

export function decodeCursor(cursor: string): { id: string; created_at: Date } | null {
    try {
        const payload = Buffer.from(cursor, 'base64').toString('utf-8');
        const parsed = JSON.parse(payload);
        if (parsed.id && parsed.created_at) {
            return { id: parsed.id, created_at: new Date(parsed.created_at) };
        }
        return null;
    } catch {
        return null;
    }
}

export function paginateQuery<T extends Record<string, any>>(
    items: T[], 
    limit: number, 
    cursorField: keyof T = 'createdAt', 
    idField: keyof T = 'id'
): { data: T[], nextCursor: string | null, hasMore: boolean } {
    let hasMore = false;
    
    // If the database returned limit + 1 items, there is a next page
    if (items.length > limit) {
        hasMore = true;
        items.pop(); // Remove the extra item
    }

    let nextCursor: string | null = null;
    if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(lastItem[idField], lastItem[cursorField]);
    }

    return {
        data: items,
        nextCursor,
        hasMore
    };
}
