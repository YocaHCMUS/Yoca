import { tokenAiChatCache } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, eq, gt } from "drizzle-orm";

import type { TokenAiChatData, TokenAiLanguage, TokenAiTimeframe } from "./token-ai-chat.service.js";

export interface TokenAiChatCacheKey {
  tokenAddress: string;
  normalizedQuestionHash: string;
  timeframe: TokenAiTimeframe;
  language: TokenAiLanguage;
  promptVersion: string;
  model: string;
  evidenceHash: string;
}

export interface TokenAiChatCacheEntry {
  data: TokenAiChatData;
  expiresAt: string;
}

const TOKEN_AI_CHAT_CACHE_TTL_MS: Record<TokenAiTimeframe, number> = {
  "24h": 10 * 60 * 1000,
  "7d": 30 * 60 * 1000,
  "1m": 60 * 60 * 1000,
  "3m": 60 * 60 * 1000,
  "1y": 60 * 60 * 1000,
};

function isMissingCacheTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as { code?: unknown; message?: unknown };
  return (
    record.code === "42P01" ||
    (typeof record.message === "string" &&
      record.message.includes("token_ai_chat_cache"))
  );
}

export function getTokenAiChatCacheExpiresAt(timeframe: TokenAiTimeframe) {
  return new Date(Date.now() + TOKEN_AI_CHAT_CACHE_TTL_MS[timeframe]);
}

export async function readTokenAiChatCache(
  key: TokenAiChatCacheKey,
): Promise<TokenAiChatCacheEntry | null> {
  try {
    const [row] = await db
      .select({
        responseJson: tokenAiChatCache.responseJson,
        expiresAt: tokenAiChatCache.expiresAt,
      })
      .from(tokenAiChatCache)
      .where(
        and(
          eq(tokenAiChatCache.tokenAddress, key.tokenAddress),
          eq(
            tokenAiChatCache.normalizedQuestionHash,
            key.normalizedQuestionHash,
          ),
          eq(tokenAiChatCache.timeframe, key.timeframe),
          eq(tokenAiChatCache.language, key.language),
          eq(tokenAiChatCache.promptVersion, key.promptVersion),
          eq(tokenAiChatCache.model, key.model),
          eq(tokenAiChatCache.evidenceHash, key.evidenceHash),
          gt(tokenAiChatCache.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!row) return null;

    return {
      data: row.responseJson as unknown as TokenAiChatData,
      expiresAt: row.expiresAt.toISOString(),
    };
  } catch (err) {
    if (isMissingCacheTableError(err)) {
      console.warn(
        "[token-ai-chat-cache] token_ai_chat_cache table not found; continuing without DB cache until migration is applied",
      );
      return null;
    }
    throw err;
  }
}

export async function writeTokenAiChatCache(
  key: TokenAiChatCacheKey,
  data: TokenAiChatData,
  expiresAt: Date,
) {
  const now = new Date();

  try {
    await db
      .insert(tokenAiChatCache)
      .values({
        tokenAddress: key.tokenAddress,
        normalizedQuestionHash: key.normalizedQuestionHash,
        timeframe: key.timeframe,
        language: key.language,
        promptVersion: key.promptVersion,
        model: key.model,
        responseJson: data as unknown as Record<string, unknown>,
        evidenceHash: key.evidenceHash,
        createdAt: now,
        updatedAt: now,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [
          tokenAiChatCache.tokenAddress,
          tokenAiChatCache.normalizedQuestionHash,
          tokenAiChatCache.timeframe,
          tokenAiChatCache.language,
          tokenAiChatCache.promptVersion,
          tokenAiChatCache.model,
          tokenAiChatCache.evidenceHash,
        ],
        set: {
          responseJson: data as unknown as Record<string, unknown>,
          updatedAt: now,
          expiresAt,
        },
      });
  } catch (err) {
    if (isMissingCacheTableError(err)) return;
    throw err;
  }
}
