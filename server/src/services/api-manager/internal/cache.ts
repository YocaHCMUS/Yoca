// Redis / In-memory cache wrapper
import { getRedisClient } from "./redis.js";

export class Cache {
  private memory = new Map<string, unknown>();
  private redis = getRedisClient();

  async get<T>(key: string): Promise<T | undefined> {
    try {
      // Try Redis first
      if (this.redis) {
        const val = await this.redis.get(key);
        if (val !== null) return JSON.parse(val) as T;
      }
      // Fallback to memory
      return this.memory.get(key) as T | undefined;
    } catch { /* ignore cache errors */ }
  }

  async set<T>(key: string, value: T, ttlSec = 60): Promise<void> {
    try {
      if (this.redis) {
        // Set in Redis
        await this.redis.set(key, JSON.stringify(value), { EX: ttlSec });
      } else {
        // Set in memory
        this.memory.set(key, value);
      }
    } catch { /* ignore cache errors */ }
  }
}
