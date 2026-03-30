// Redis client singleton
import { createClient, RedisClientType } from 'redis';

let client: RedisClientType | null = null;
let redisAvailable = false;

const noopClient = {
    get: async (_: string) => null,
    set: async (_: string, __: string, ___?: any) => 'OK',
    connect: async () => undefined,
} as unknown as RedisClientType;

export function getRedisClient(): RedisClientType {
    const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || !!process.env.VITEST_WORKER_ID;
    if (isTest) {
        return noopClient;
    }
    if (!client) {
        client = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
        });
        client.on('error', (err) => {
            if (redisAvailable) {
                console.warn('[Redis] Connection lost:', err.message);
            } else {
                console.warn('[Redis] Not available — running without cache:', err.message);
            }
            redisAvailable = false;
        });
        client.on('ready', () => {
            console.log('[Redis] Connected');
            redisAvailable = true;
        });
        client.connect().catch(() => {
            // Handled by the 'error' event above
        });
    }
    if (!redisAvailable) {
        return noopClient;
    }
    return client;
}
