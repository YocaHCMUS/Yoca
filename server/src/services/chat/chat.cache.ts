import { createHash } from "node:crypto";
import { db } from "@sv/db/index.js";
import { chatAnalysisCache } from "@sv/db/schema.js";
import { eq } from "drizzle-orm";
import type { ChatResponse } from "./chat.types.js";
import { CHAT_CACHE_HARD_TTL_MS } from "@sv/config/constants.js";
import { getEffectiveCacheTtl, hasUncacheableTools } from "./chat.tools.js";

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

function sortedAddressesKey(addresses: string[]): string {
  return [...addresses].sort().join("|");
}

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

function computeKey(
  addresses: string[],
  query: string,
  model: string,
  fingerprint: string,
  historyHash?: string,
  intent?: string,
): string {
  const addrsKey = sortedAddressesKey(addresses);
  return createHash("sha256")
    .update(`${addrsKey}|${query.trim().toLowerCase()}|${model}|${fingerprint}|${historyHash ?? ""}|${intent ?? ""}`)
    .digest("hex");
}

export async function getCachedResponse(
  addresses: string[],
  query: string,
  model: string,
  historyHash?: string,
  intent?: string,
): Promise<ChatResponse | null> {
  const fingerprint = await computeDataFingerprint(addresses);
  const key = computeKey(addresses, query, model, fingerprint, historyHash, intent);

  const rows = await db
    .select()
    .from(chatAnalysisCache)
    .where(eq(chatAnalysisCache.key, key))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];

  // Entries with errors should never be served — force re-fetch
  if (row.hasErrors) return null;

  const ageMs = Date.now() - new Date(row.fetchedAt).getTime();

  // Compute effective TTL from the tools that were used
  const effectiveTtl = getEffectiveCacheTtl(row.toolsUsed ?? []);
  const effectiveHardTtl = effectiveTtl != null
    ? Math.max(effectiveTtl * 3, 60_000)
    : CHAT_CACHE_HARD_TTL_MS;

  // Hard TTL — unconditional miss
  if (effectiveHardTtl > 0 && ageMs > effectiveHardTtl) return null;

  // Soft TTL — re-check fingerprint
  if (effectiveTtl != null && ageMs > effectiveTtl) {
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
  toolsUsed?: string[],
  hasErrors?: boolean,
  responseType?: string,
): Promise<void> {
  // Skip caching if any tools errored — force re-fetch next time
  if (hasErrors) return;

  const resolvedTools = toolsUsed ?? [];

  // Skip caching if any tool is uncacheable (e.g. web/news search)
  if (hasUncacheableTools(resolvedTools)) return;

  const effectiveTtl = getEffectiveCacheTtl(resolvedTools) ?? CHAT_CACHE_HARD_TTL_MS;
  const fingerprint = await computeDataFingerprint(addresses);
  const key = computeKey(addresses, query, model, fingerprint, historyHash, intent);

  await db
    .insert(chatAnalysisCache)
    .values({
      key,
      walletAddress: addresses[0],
      query,
      response: response as unknown as Record<string, unknown>,
      dataFingerprint: fingerprint,
      model,
      ttlMs: effectiveTtl,
      fetchedAt: new Date(),
      toolsUsed: resolvedTools,
      hasErrors: false,
      responseType: responseType ?? "tool_generated",
    })
    .onConflictDoUpdate({
      target: [chatAnalysisCache.key],
      set: {
        response: response as unknown as Record<string, unknown>,
        dataFingerprint: fingerprint,
        model,
        ttlMs: effectiveTtl,
        fetchedAt: new Date(),
        toolsUsed: resolvedTools,
        hasErrors: false,
        responseType: responseType ?? "tool_generated",
      },
    });
}

export async function computeCacheKey(
  addresses: string[],
  query: string,
  model: string,
  intent?: string,
): Promise<string> {
  const fingerprint = await computeDataFingerprint(addresses);
  return computeKey(addresses, query, model, fingerprint, undefined, intent);
}