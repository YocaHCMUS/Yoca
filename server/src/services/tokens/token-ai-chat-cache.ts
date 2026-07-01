import { tokenAiChatCache } from "@sv/db/schema.js";
import { db } from "@sv/db/index.js";
import { and, desc, eq, gt } from "drizzle-orm";

import type {
  TokenAiChatData,
  TokenAiIntent,
  TokenAiLanguage,
  TokenAiTimeframe,
} from "./token-ai-chat.service.js";

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
  updatedAt?: string;
}

const TOKEN_AI_CHAT_CACHE_TTL_MS: Record<TokenAiTimeframe, number> = {
  "24h": 10 * 60 * 1000,
  "7d": 30 * 60 * 1000,
  "1m": 60 * 60 * 1000,
  "3m": 60 * 60 * 1000,
  "1y": 60 * 60 * 1000,
};

const LAST_SUCCESSFUL_GEMINI_MODEL = "__last_successful_gemini__";
const LAST_SUCCESSFUL_GEMINI_EVIDENCE_HASH = "__last_good__";

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
        updatedAt: tokenAiChatCache.updatedAt,
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
      updatedAt: row.updatedAt.toISOString(),
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

export interface TokenAiLastSuccessfulGeminiKey {
  tokenAddress: string;
  intent: TokenAiIntent;
  normalizedQuestionHash: string;
  timeframe: TokenAiTimeframe;
  language: TokenAiLanguage;
  promptVersion: string;
}

function lastSuccessfulQuestionHash(key: TokenAiLastSuccessfulGeminiKey) {
  return key.intent === "custom"
    ? `last-good:${key.intent}:${key.normalizedQuestionHash}`
    : `last-good:${key.intent}`;
}

export async function readLastSuccessfulGeminiCache(
  key: TokenAiLastSuccessfulGeminiKey,
): Promise<TokenAiChatCacheEntry | null> {
  try {
    const [row] = await db
      .select({
        responseJson: tokenAiChatCache.responseJson,
        expiresAt: tokenAiChatCache.expiresAt,
        updatedAt: tokenAiChatCache.updatedAt,
      })
      .from(tokenAiChatCache)
      .where(
        and(
          eq(tokenAiChatCache.tokenAddress, key.tokenAddress),
          eq(
            tokenAiChatCache.normalizedQuestionHash,
            lastSuccessfulQuestionHash(key),
          ),
          eq(tokenAiChatCache.timeframe, key.timeframe),
          eq(tokenAiChatCache.language, key.language),
          eq(tokenAiChatCache.promptVersion, key.promptVersion),
          eq(tokenAiChatCache.model, LAST_SUCCESSFUL_GEMINI_MODEL),
          eq(tokenAiChatCache.evidenceHash, LAST_SUCCESSFUL_GEMINI_EVIDENCE_HASH),
          gt(tokenAiChatCache.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(tokenAiChatCache.updatedAt))
      .limit(1);

    if (!row) return null;

    return {
      data: row.responseJson as unknown as TokenAiChatData,
      expiresAt: row.expiresAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (err) {
    if (isMissingCacheTableError(err)) return null;
    throw err;
  }
}

export async function writeLastSuccessfulGeminiCache(
  key: TokenAiLastSuccessfulGeminiKey,
  data: TokenAiChatData,
  expiresAt: Date,
) {
  const now = new Date();

  try {
    await db
      .insert(tokenAiChatCache)
      .values({
        tokenAddress: key.tokenAddress,
        normalizedQuestionHash: lastSuccessfulQuestionHash(key),
        timeframe: key.timeframe,
        language: key.language,
        promptVersion: key.promptVersion,
        model: LAST_SUCCESSFUL_GEMINI_MODEL,
        responseJson: data as unknown as Record<string, unknown>,
        evidenceHash: LAST_SUCCESSFUL_GEMINI_EVIDENCE_HASH,
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
