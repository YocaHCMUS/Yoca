import { createHash } from "node:crypto";
import { db } from "@sv/db/index.js";
import { chatAnalysisCache } from "@sv/db/schema.js";
import { eq } from "drizzle-orm";
import type { ChatResponse } from "./chat.types.js";
import { CHAT_CACHE_TTL_MS, CHAT_CACHE_HARD_TTL_MS } from "@sv/config/constants.js";

export interface CacheDependency {
  type: "wallet_swaps" | "wallet_transfers" | "wallet_balance";
  address: string;
}

export interface CacheMeta {
  key: string;
  walletAddress: string;
  query: string;
  response: ChatResponse;
  dependencies: CacheDependency[];
  model: string;
  fetchedAt: Date;
  ttlMs: number;
}

/**
 * Compute a data fingerprint for wallets based on easily-checked metrics.
 * Hashes latest swap data across ALL addresses for staleness detection.
 */
async function computeDataFingerprint(addresses: string[]): Promise<string> {
  const hash = createHash("sha256");

  for (const address of addresses) {
    try {
      const { getWalletSwaps } = await import(
        "@sv/services/wallet/walletTransfersSwaps.service.js"
      );
      const swaps = await getWalletSwaps(address);

      const txCount = swaps?.swaps?.length ?? 0;
      hash.update(`addr:${address}:tx:${txCount}`);

      if (swaps?.swaps && swaps.swaps.length > 0) {
        const lastSig = swaps.swaps[0]?.transactionHash ?? "";
        const lastTs = swaps.swaps[0]?.blockTimestampIso ?? "";
        hash.update(`addr:${address}:last:${lastSig}:${lastTs}`);
      }
    } catch {
      hash.update(`addr:${address}:swaps_failed`);
    }
  }

  return hash.digest("hex").slice(0, 16);
}

function sortedAddressesKey(addresses: string[]): string {
  return [...addresses].sort().join("|");
}

export async function computeCacheKey(
  addresses: string[],
  query: string,
  model: string,
  intent?: string,
): Promise<string> {
  const addrsKey = sortedAddressesKey(addresses);
  const fingerprint = await computeDataFingerprint(addresses);
  const hash = createHash("sha256")
    .update(`${addrsKey}|${query.trim().toLowerCase()}|${model}|${fingerprint}|${intent ?? "custom"}`)
    .digest("hex");
  return hash;
}

export async function getCachedResponse(
  addresses: string[],
  query: string,
  model: string,
  historyHash?: string,
  intent?: string,
): Promise<ChatResponse | null> {
  const addrsKey = sortedAddressesKey(addresses);
  const fingerprint = await computeDataFingerprint(addresses);
  const key = createHash("sha256")
    .update(`${addrsKey}|${query.trim().toLowerCase()}|${model}|${fingerprint}|${historyHash ?? ""}|${intent ?? ""}`)
    .digest("hex");

  const rows = await db
    .select()
    .from(chatAnalysisCache)
    .where(eq(chatAnalysisCache.key, key))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  const ageMs = Date.now() - new Date(row.fetchedAt).getTime();

  if (ageMs > CHAT_CACHE_HARD_TTL_MS) return null;

  if (ageMs > CHAT_CACHE_TTL_MS) {
    const currentFingerprint = await computeDataFingerprint(addresses);
    if (row.dataFingerprint !== currentFingerprint) return null;
  }

  return row.response as unknown as ChatResponse;
}

export async function setCachedResponse(
  addresses: string[],
  query: string,
  response: ChatResponse,
  model: string,
  historyHash?: string,
  intent?: string,
): Promise<void> {
  const addrsKey = sortedAddressesKey(addresses);
  const fingerprint = await computeDataFingerprint(addresses);
  const key = createHash("sha256")
    .update(`${addrsKey}|${query.trim().toLowerCase()}|${model}|${fingerprint}|${historyHash ?? ""}|${intent ?? ""}`)
    .digest("hex");

  await db
    .insert(chatAnalysisCache)
    .values({
      key,
      walletAddress: addresses[0],
      query,
      response: response as unknown as Record<string, unknown>,
      dataFingerprint: fingerprint,
      model,
      ttlMs: CHAT_CACHE_HARD_TTL_MS,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [chatAnalysisCache.key],
      set: {
        response: response as unknown as Record<string, unknown>,
        dataFingerprint: fingerprint,
        model,
        ttlMs: CHAT_CACHE_HARD_TTL_MS,
        fetchedAt: new Date(),
      },
    });
}
