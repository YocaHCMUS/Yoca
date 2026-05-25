import { GoogleGenAI, Type } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  GOOGLE_AI_KEY,
  WALLET_AUDIT_MODEL,
  WALLET_AUDIT_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { walletAiSwapSummaryCache } from "@sv/db/schema.js";
import { getWalletSwaps } from "@sv/services/wallet/walletTransfersSwaps.service.js";
import { isValidSolanaAddress } from "@sv/services/wallet/walletIdentity.service.js";

import type { WalletSwap } from "./dtos/walletDataObjects.js";
import {
  walletAiSwapSummaryResponseSchema,
  type WalletAiSwapSummaryErrorCode,
  type WalletAiSwapSummaryResponse,
} from "./dtos/walletAiSwapSummaryObjects.js";
import type { WalletAiSwapSummaryPersisted, TokenPnlBreakdownPersisted } from "@sv/db/schema.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWAPS_SAMPLE_SIZE = 100;
const GEMINI_MODEL = process.env.GEMINI_SWAP_SUMMARY_MODEL?.trim() || WALLET_AUDIT_MODEL;

const SYSTEM_PROMPT_EN =
  "You are a crypto trading analyst. Given the wallet's per-token PnL breakdown, " +
  "produce a simple, plain-English trading summary and risk analysis. " +
  "For risk analysis, describe what risk management behavior the wallet shows " +
  "(e.g. does it cut losses early, hold bags, diversify, use stop-loss patterns?) " +
  "and how much risk the wallet is willing to take. Do NOT give investment advice. " +
  "Respond in English. Output ONLY valid JSON with keys: summary (string), riskNotes (array of strings).";

const SYSTEM_PROMPT_VN =
  "Bạn là chuyên gia phân tích giao dịch crypto. Dựa trên bảng phân tích PnL theo từng token của ví, " +
  "hãy đưa ra bản tóm tắt giao dịch đơn giản, dễ hiểu. " +
  "Về phân tích rủi ro, hãy mô tả hành vi quản lý rủi ro mà ví đang thể hiện " +
  "(ví dụ: có cắt lỗ sớm không, có nắm giữ token lỗ không, có đa dạng hóa không, có dùng stop-loss không?) " +
  "và mức độ rủi ro mà ví sẵn sàng chấp nhận. KHÔNG đưa ra lời khuyên đầu tư. " +
  "Trả lời bằng tiếng Việt. Chỉ xuất JSON hợp lệ với các key: summary (string), riskNotes (mảng string).";

export class WalletAiSwapSummaryServiceError extends Error {
  readonly code: WalletAiSwapSummaryErrorCode;
  readonly status: number;

  constructor(message: string, code: WalletAiSwapSummaryErrorCode, status: number) {
    super(message);
    this.name = "WalletAiSwapSummaryServiceError";
    this.code = code;
    this.status = status;
  }
}

const GEMINI_RESPONSE_SCHEMA = z.object({
  summary: z.string().min(1),
  riskNotes: z.array(z.string().min(1)),
});

// ---------------------------------------------------------------------------
// FIFO PnL computation
// ---------------------------------------------------------------------------

interface TokenAccumulator {
  address: string;
  symbol: string | null;
  name: string | null;
  logoUri: string | null;
  entryQueue: Array<{ amount: number; price: number; remaining: number; timestampMs: number }>;
  realizedPnl: number;
  wins: number;
  exits: number;
  buyCount: number;
  sellCount: number;
  entryPrices: number[];
  exitPrices: number[];
  totalBought: number;
  totalSold: number;
  longestHoldingTimeMs: number | null;
  maxTolerableLossPercent: number | null;
  minRealizedWinPercent: number | null;
}

function computePerTokenPnl(swaps: WalletSwap[]): TokenAccumulator[] {
  const tokenMap = new Map<string, TokenAccumulator>();

  const sorted = [...swaps].sort(
    (a, b) => new Date(a.blockTimestampIso).getTime() - new Date(b.blockTimestampIso).getTime(),
  );

  for (const swap of sorted) {
    const bought = swap.bought;
    const sold = swap.sold;
    if (!bought || !sold) continue;

    // -- bought side: token enters wallet --
    {
      let acc = tokenMap.get(bought.address);
      if (!acc) {
        acc = {
          address: bought.address,
          symbol: bought.symbol,
          name: bought.name,
          logoUri: bought.logoUri,
          entryQueue: [],
          realizedPnl: 0,
          wins: 0,
          exits: 0,
          buyCount: 0,
          sellCount: 0,
          entryPrices: [],
          exitPrices: [],
          totalBought: 0,
          totalSold: 0,
          longestHoldingTimeMs: null,
          maxTolerableLossPercent: null,
          minRealizedWinPercent: null,
        };
        tokenMap.set(bought.address, acc);
      }
      acc.entryQueue.push({ amount: bought.amount, price: bought.priceUsd, remaining: bought.amount, timestampMs: new Date(swap.blockTimestampIso).getTime() });
      acc.entryPrices.push(bought.priceUsd);
      acc.totalBought += bought.amount;
      acc.buyCount += 1;
    }

    // -- sold side: token exits wallet --
    {
      let acc = tokenMap.get(sold.address);
      if (!acc) {
        acc = {
          address: sold.address,
          symbol: sold.symbol,
          name: sold.name,
          logoUri: sold.logoUri,
          entryQueue: [],
          realizedPnl: 0,
          wins: 0,
          exits: 0,
          buyCount: 0,
          sellCount: 0,
          entryPrices: [],
          exitPrices: [],
          totalBought: 0,
          totalSold: 0,
          longestHoldingTimeMs: null,
          maxTolerableLossPercent: null,
          minRealizedWinPercent: null,
        };
        tokenMap.set(sold.address, acc);
      }

      let remainingExit = sold.amount;
      acc.totalSold += sold.amount;
      acc.sellCount += 1;
      const sellTimeMs = new Date(swap.blockTimestampIso).getTime();

      while (remainingExit > 0 && acc.entryQueue.length > 0) {
        const lot = acc.entryQueue[0];
        const matched = Math.min(remainingExit, lot.remaining);
        lot.remaining -= matched;
        remainingExit -= matched;

        const contribution = matched * (sold.priceUsd - lot.price);
        acc.realizedPnl += contribution;
        if (contribution > 0) acc.wins += 1;

        const holdMs = sellTimeMs - lot.timestampMs;
        if (acc.longestHoldingTimeMs === null || holdMs > acc.longestHoldingTimeMs) {
          acc.longestHoldingTimeMs = holdMs;
        }

        const retPct = lot.price > 0 ? (sold.priceUsd - lot.price) / lot.price : 0;
        if (retPct < 0) {
          if (acc.maxTolerableLossPercent === null || retPct < acc.maxTolerableLossPercent) {
            acc.maxTolerableLossPercent = retPct;
          }
        } else {
          if (acc.minRealizedWinPercent === null || retPct < acc.minRealizedWinPercent) {
            acc.minRealizedWinPercent = retPct;
          }
        }

        if (lot.remaining <= 1e-12) {
          acc.entryQueue.shift();
          acc.exitPrices.push(sold.priceUsd);
        }
      }

      acc.exits += 1;
    }
  }

  return Array.from(tokenMap.values());
}

function buildBreakdown(acc: TokenAccumulator): TokenPnlBreakdownPersisted {
  const entryPrices = acc.entryPrices;
  const exitPrices = acc.exitPrices;
  return {
    address: acc.address,
    symbol: acc.symbol,
    name: acc.name,
    logoUri: acc.logoUri,
    pnlUsd: round2(acc.realizedPnl),
    trades: acc.buyCount + acc.sellCount,
    wins: acc.wins,
    buyCount: acc.buyCount,
    sellCount: acc.sellCount,
    totalEntered: round2(acc.totalBought),
    totalExited: round2(acc.totalSold),
    entryPriceRange: entryPrices.length > 0 ? [Math.min(...entryPrices), Math.max(...entryPrices)] : null,
    exitPriceRange: exitPrices.length > 0 ? [Math.min(...exitPrices), Math.max(...exitPrices)] : null,
    longestHoldingTimeMs: acc.longestHoldingTimeMs,
    maxTolerableLossPercent: acc.maxTolerableLossPercent !== null ? round2(acc.maxTolerableLossPercent * 100) : null,
    minRealizedWinPercent: acc.minRealizedWinPercent !== null ? round2(acc.minRealizedWinPercent * 100) : null,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

async function readCachedSummary(
  address: string,
  language: string,
): Promise<WalletAiSwapSummaryResponse | null> {
  const threshold = new Date(Date.now() - WALLET_AUDIT_TTL_MS);
  const rows = await db
    .select()
    .from(walletAiSwapSummaryCache)
    .where(
      and(
        eq(walletAiSwapSummaryCache.address, address),
        eq(walletAiSwapSummaryCache.language, language),
      ),
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  if (row.fetchedAt < threshold) return null;

  return {
    address: row.address,
    language: row.language as "en" | "vn",
    tradeCount: row.response.tradeCount,
    realizedPnlUsd: row.response.realizedPnlUsd,
    winningPercentage: row.response.winningPercentage,
    totalBoughtUsd: row.response.totalBoughtUsd,
    totalSoldUsd: row.response.totalSoldUsd,
    topProfitable: row.response.topProfitable,
    topLoser: row.response.topLoser,
    allTokenBreakdowns: row.response.allTokenBreakdowns ?? [],
    riskNotes: row.response.riskNotes,
    summary: row.response.summary,
    model: row.model,
    fetchedAt: row.fetchedAt.toISOString(),
    cached: true,
  };
}

async function writeCachedSummary(
  address: string,
  language: string,
  response: WalletAiSwapSummaryPersisted,
  model: string,
): Promise<void> {
  await db
    .insert(walletAiSwapSummaryCache)
    .values({
      address,
      language,
      response,
      model,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [walletAiSwapSummaryCache.address, walletAiSwapSummaryCache.language],
      set: {
        response,
        model,
        fetchedAt: new Date(),
      },
    });
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

let cachedGenAiClient: GoogleGenAI | null = null;

function getGenAiClient(): GoogleGenAI {
  const key = GOOGLE_AI_KEY || process.env.GOOGLE_AI_KEY;
  if (!key) {
    throw new WalletAiSwapSummaryServiceError(
      "GOOGLE_AI_KEY is not configured on the server.",
      "model_error",
      502,
    );
  }
  if (!cachedGenAiClient) {
    cachedGenAiClient = new GoogleGenAI({ apiKey: key });
  }
  return cachedGenAiClient;
}

async function callGemini(
  breakdowns: TokenPnlBreakdownPersisted[],
  aggregated: {
    tradeCount: number;
    realizedPnlUsd: number;
    winningPercentage: number;
    totalBoughtUsd: number;
    totalSoldUsd: number;
  },
  language: "en" | "vn",
): Promise<{ summary: string; riskNotes: string[] }> {
  const client = getGenAiClient();

  const userPayload = {
    tradeCount: aggregated.tradeCount,
    realizedPnlUsd: aggregated.realizedPnlUsd,
    winningPercentage: aggregated.winningPercentage,
    totalBoughtUsd: aggregated.totalBoughtUsd,
    totalSoldUsd: aggregated.totalSoldUsd,
    tokenBreakdowns: breakdowns,
  };

  const systemPrompt = language === "vn" ? SYSTEM_PROMPT_VN : SYSTEM_PROMPT_EN;

  let response;
  try {
    response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: JSON.stringify(userPayload, null, 2),
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            riskNotes: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["summary", "riskNotes"],
        },
      },
    });
  } catch (err) {
    throw new WalletAiSwapSummaryServiceError(
      `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`,
      "model_error",
      502,
    );
  }

  const rawText = response.text;
  if (!rawText) {
    throw new WalletAiSwapSummaryServiceError(
      "Gemini returned an empty response.",
      "invalid_model_response",
      502,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    throw new WalletAiSwapSummaryServiceError(
      `Gemini returned non-JSON output: ${err instanceof Error ? err.message : String(err)}`,
      "invalid_model_response",
      502,
    );
  }

  const validation = GEMINI_RESPONSE_SCHEMA.safeParse(parsed);
  if (!validation.success) {
    throw new WalletAiSwapSummaryServiceError(
      `Gemini response failed schema validation: ${validation.error.message}`,
      "invalid_model_response",
      502,
    );
  }

  return validation.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getWalletAiSwapSummary(
  address: string,
  language: "en" | "vn" = "en",
): Promise<WalletAiSwapSummaryResponse> {
  const normalizedAddress = address.trim();

  if (!normalizedAddress || !isValidSolanaAddress(normalizedAddress)) {
    throw new WalletAiSwapSummaryServiceError(
      "Invalid Solana wallet address",
      "invalid_address",
      400,
    );
  }

  const cached = await readCachedSummary(normalizedAddress, language);
  if (cached) return cached;

  const swapsResult = await getWalletSwaps(normalizedAddress);
  const recent = (swapsResult.swaps ?? []).slice(0, SWAPS_SAMPLE_SIZE);

  if (recent.length < 2) {
    throw new WalletAiSwapSummaryServiceError(
      "Not enough swap data to generate a summary (need at least 2 swaps).",
      "no_data",
      409,
    );
  }

  const accumulators = computePerTokenPnl(recent);
  const breakdowns = accumulators.map(buildBreakdown);

  let totalBoughtUsd = 0;
  let totalSoldUsd = 0;
  for (const swap of recent) {
    if (swap.bought?.valueUsd) totalBoughtUsd += swap.bought.valueUsd;
    if (swap.sold?.valueUsd) totalSoldUsd += swap.sold.valueUsd;
  }

  const sortedByPnl = [...breakdowns].sort((a, b) => b.pnlUsd - a.pnlUsd);
  const topProfitable = sortedByPnl.find((t) => t.pnlUsd > 0) ?? null;
  const topLoser = [...sortedByPnl].reverse().find((t) => t.pnlUsd < 0) ?? null;
  const allTokenBreakdowns = sortedByPnl;

  const totalExits = accumulators.reduce((s, a) => s + a.exits, 0);
  const totalWins = accumulators.reduce((s, a) => s + a.wins, 0);
  const winningPercentage = totalExits > 0 ? round2((totalWins / totalExits) * 100) : 0;

  const aggregated = {
    tradeCount: recent.length,
    realizedPnlUsd: round2(accumulators.reduce((s, a) => s + a.realizedPnl, 0)),
    winningPercentage,
    totalBoughtUsd: round2(totalBoughtUsd),
    totalSoldUsd: round2(totalSoldUsd),
  };
  const { summary, riskNotes } = await callGemini(breakdowns, aggregated, language);

  const persisted: WalletAiSwapSummaryPersisted = {
    tradeCount: aggregated.tradeCount,
    realizedPnlUsd: aggregated.realizedPnlUsd,
    winningPercentage: aggregated.winningPercentage,
    totalBoughtUsd: aggregated.totalBoughtUsd,
    totalSoldUsd: aggregated.totalSoldUsd,
    topProfitable,
    topLoser,
    allTokenBreakdowns,
    riskNotes,
    summary,
  };

  await writeCachedSummary(normalizedAddress, language, persisted, GEMINI_MODEL);

  const result: WalletAiSwapSummaryResponse = {
    address: normalizedAddress,
    language,
    ...persisted,
    model: GEMINI_MODEL,
    fetchedAt: new Date().toISOString(),
    cached: false,
  };

  const schemaValidation = walletAiSwapSummaryResponseSchema.safeParse(result);
  if (!schemaValidation.success) {
    throw new WalletAiSwapSummaryServiceError(
      `Internal response validation failed: ${schemaValidation.error.message}`,
      "provider_unknown",
      502,
    );
  }

  return schemaValidation.data;
}
