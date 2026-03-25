// Redis / In-memory cache wrapper
import { getRedisClient } from './redis';

export class Cache {
    private memory = new Map<string, any>();
    private redis = getRedisClient();

    async get<T>(key: string): Promise<T | undefined> {
        // Try Redis first
        try {
            const val = await this.redis.get(key);
            if (val !== null) return JSON.parse(val);
        } catch { }
        // Fallback to memory
        return this.memory.get(key);
    }

    async set<T>(key: string, value: T, ttlSec = 60): Promise<void> {
        // Set in Redis
        try {
            await this.redis.set(key, JSON.stringify(value), { EX: ttlSec });
        } catch { }
        // Set in memory
        this.memory.set(key, value);
    }
}
