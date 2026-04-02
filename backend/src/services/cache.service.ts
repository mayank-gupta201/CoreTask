import Redis from 'ioredis';

// Instantiate Redis using env or local default
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export class CacheService {
    /**
     * Get a value from Redis cache. If not found, execute the fetcher function,
     * store the result with the defined TTL, and return it.
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
        const cached = await redisClient.get(key);
        if (cached) {
            try {
                return JSON.parse(cached) as T;
            } catch {
                // If parse fails, fallback to passing through to fetcher
            }
        }

        const freshData = await fetcher();
        
        if (freshData !== undefined && freshData !== null) {
            await redisClient.setex(key, ttlSeconds, JSON.stringify(freshData));
        }

        return freshData;
    }

    /**
     * Invalidate a single, specific key
     */
    async invalidate(key: string): Promise<void> {
        await redisClient.del(key);
    }

    /**
     * Invalidate all keys matching a pattern (uses SCAN to avoid blocking)
     */
    async invalidatePattern(pattern: string): Promise<void> {
        let cursor = '0';
        do {
            // SCAN iterates keys safely without blocking Redis like KEYS does
            const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
            cursor = nextCursor;
            
            if (keys.length > 0) {
                await redisClient.del(...keys);
            }
        } while (cursor !== '0');
    }

    // Standardized Cache Keys
    static keys = {
        workspaceDashboard: (workspaceId: string) => `dashboard:workspace:${workspaceId}`,
        portfolioDashboard: (portfolioId: string) => `dashboard:portfolio:${portfolioId}`,
        resourceGrid: (workspaceId: string, dateRange: string) => `resources:${workspaceId}:${dateRange}`,
        userUtilization: (userId: string, workspaceId: string) => `util:${userId}:${workspaceId}`,
    };
}

export const cacheService = new CacheService();
