// Redis client singleton
import { createClient, RedisClientType } from "redis";

let client: RedisClientType | null = null;

export function getRedisClient(): RedisClientType | null {
  const isTest =
    process.env.NODE_ENV === "test" ||
    process.env.VITEST === "true" ||
    !!process.env.VITEST_WORKER_ID;

  if (isTest) {
    // Return a minimal in-memory/dummy client for tests so we don't require
    // a real Redis instance and prevent cross-test persistence.
    return {
      get: async (_: string) => null,
      set: async (_: string, __: string, ___?: any) => "OK",
      connect: async () => undefined,
    } as unknown as RedisClientType;
  }
  if (!client) {
    console.log("creating client ...");

    client = createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
    });
    return null;
    // client.connect();
  }
  return client;
}
