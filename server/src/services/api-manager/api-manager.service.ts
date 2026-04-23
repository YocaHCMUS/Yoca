// Main entry point for API Call Management System
import { Cache } from "./internal/cache.js";
import { coalesce } from "./internal/coalescer.js";
import { ThrottledQueue } from "./internal/queue.js";
// import { birdeyeConfig } from './providers/birdeye.config';
// import { heliusConfig } from './providers/helius.config';

import { ZodSchema } from "zod";

type Provider = "birdeye" | "helius" | "n8n";
// const providerConfigs = {
//     birdeye: birdeyeConfig,
//     helius: heliusConfig,
// };

export class ApiManagerService {
  private cache = new Cache();
  private queues: Record<Provider, ThrottledQueue> = {
    birdeye: new ThrottledQueue(),
    helius: new ThrottledQueue(),
    n8n: new ThrottledQueue(),
  };

  /**
   * Gatekeeper method for external API calls
   * @param provider Provider name
   * @param endpoint Endpoint string
   * @param params Request params
   * @param fetcher Function to fetch data from provider
   */
  async call<T>(
    provider: Provider,
    endpoint: string,
    params: unknown,
    fetcher: () => Promise<T>,
    opts?: {
      requestSchema?: ZodSchema<unknown>;
      responseSchema?: ZodSchema<T>;
    },
  ): Promise<T> {
    const key = this.generateKey(provider, endpoint, params);
    // Zod request validation
    if (opts?.requestSchema) opts.requestSchema.parse(params);
    // Phase B: Cache-Aside
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined) return cached;
    // Phase B: Check PostgreSQL (Drizzle)
    // In test environments we skip DB access to avoid requiring a live Postgres
    // instance; tests rely on in-memory behavior provided by the Cache/coalescer.
    // const isTestEnv = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true' || !!process.env.VITEST_WORKER_ID;
    // if (!isTestEnv) {
    //     // Use Drizzle ORM eq helper for where clause
    //     // eslint-disable-next-line @typescript-eslint/no-var-requires
    //     const { eq } = await import('drizzle-orm');
    //     const dbRows = await db.select().from(acmsApiCache).where(eq(acmsApiCache.key, key)).limit(1);
    //     if (dbRows.length > 0) {
    //         const dbResult = dbRows[0].result as T;
    //         await this.cache.set(key, dbResult);
    //         // Zod response validation
    //         if (opts?.responseSchema) opts.responseSchema.parse(dbResult);
    //         return dbResult;
    //     }
    // }
    // Phase C: Throttled Queue
    const queue = this.queues[provider];
    const queuedFetcher = () => queue.push(fetcher);
    // Phase A: Coalescer
    const result = await coalesce(key, queuedFetcher);
    // Zod response validation
    if (opts?.responseSchema) opts.responseSchema.parse(result);
    await this.cache.set(key, result);
    // if (!isTestEnv) {
    //     await db.insert(acmsApiCache).values({
    //         key,
    //         provider,
    //         endpoint,
    //         params,
    //         result,
    //         createdAt: new Date(),
    //         updatedAt: new Date(),
    //     }).onConflictDoUpdate({
    //         target: acmsApiCache.key,
    //         set: { result, updatedAt: new Date() },
    //     });
    // }
    return result;
  }

  private generateKey(
    provider: Provider,
    endpoint: string,
    params: unknown,
  ): string {
    // Simple key for now; replace with hash for production
    return `${provider}:${endpoint}:${JSON.stringify(params)}`;
  }
}
