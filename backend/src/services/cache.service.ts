import Redis from 'ioredis';
import { logger } from '../middlewares/logger.middleware';

// Track whether Redis is available so we can gracefully degrade
let redisConnected = false;

// Instantiate Redis using env or local default — with resilient options
export const redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,   // Prevent MaxRetriesPerRequestError crashes
    retryStrategy(times: number) {
        if (times > 5) {
            logger.warn('Redis: max reconnect attempts reached, giving up');
            return null; // Stop retrying
        }
        return Math.min(times * 500, 3000); // Exponential back-off up to 3s
    },
    lazyConnect: false,
});

redisClient.on('connect', () => {
    redisConnected = true;
    logger.info('Redis connected successfully');
});

redisClient.on('error', (err) => {
    redisConnected = false;
    logger.warn(`Redis connection error (cache disabled): ${err.message}`);
});

redisClient.on('close', () => {
    redisConnected = false;
});

export class CacheService {
    /**
     * Check if Redis is currently available
     */
    private isAvailable(): boolean {
        return redisConnected && redisClient.status === 'ready';
    }

    /**
     * Get a value from Redis cache. If not found, execute the fetcher function,
     * store the result with the defined TTL, and return it.
     */
    async getOrSet<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
        // Try reading from cache if Redis is available
        if (this.isAvailable()) {
            try {
                const cached = await redisClient.get(key);
                if (cached) {
                    try {
                        return JSON.parse(cached) as T;
                    } catch {
                        // If parse fails, fallback to passing through to fetcher
                    }
                }
            } catch (err) {
                logger.warn(`Redis GET failed for key "${key}", falling back to fetcher`);
            }
        }

        const freshData = await fetcher();
        
        if (freshData !== undefined && freshData !== null && this.isAvailable()) {
            try {
                await redisClient.setex(key, ttlSeconds, JSON.stringify(freshData));
            } catch (err) {
                logger.warn(`Redis SETEX failed for key "${key}", skipping cache write`);
            }
        }

        return freshData;
    }

    /**
     * Invalidate a single, specific key
     */
    async invalidate(key: string): Promise<void> {
        if (!this.isAvailable()) return;
        try {
            await redisClient.del(key);
        } catch (err) {
            logger.warn(`Redis DEL failed for key "${key}"`);
        }
    }

    /**
     * Invalidate all keys matching a pattern (uses SCAN to avoid blocking)
     */
    async invalidatePattern(pattern: string): Promise<void> {
        if (!this.isAvailable()) return;
        try {
            let cursor = '0';
            do {
                // SCAN iterates keys safely without blocking Redis like KEYS does
                const [nextCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
                cursor = nextCursor;
                
                if (keys.length > 0) {
                    await redisClient.del(...keys);
                }
            } while (cursor !== '0');
        } catch (err) {
            logger.warn(`Redis SCAN/DEL failed for pattern "${pattern}"`);
        }
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
