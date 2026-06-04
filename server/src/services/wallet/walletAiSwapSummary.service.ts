import { GoogleGenAI, Type } from "@google/genai";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  GEMINI_MODEL,
  getGoogleAiKey,
  SWAPS_SAMPLE_SIZE,
  SYSTEM_PROMPT_EN,
  SYSTEM_PROMPT_VN,
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
import { isBaseAsset } from "./walletDayActivity.service.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------


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
  totalBoughtAmount: number;
  totalSoldAmount: number;
  totalBoughtUsd: number;
  totalSoldUsd: number;
  longestHoldingTimeMs: number | null;
  maxTolerableLossPercent: number | null;
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
    if (!isBaseAsset(bought.address)) {
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
          totalBoughtAmount: 0,
          totalSoldAmount: 0,
          totalBoughtUsd: 0,
          totalSoldUsd: 0,
          longestHoldingTimeMs: null,
          maxTolerableLossPercent: null,
        };
        tokenMap.set(bought.address, acc);
      }
      const entryPrice = swap.totalValueUsd && bought.amount > 0 ? swap.totalValueUsd / bought.amount : 0;
      acc.entryQueue.push({ amount: bought.amount, price: entryPrice, remaining: bought.amount, timestampMs: new Date(swap.blockTimestampIso).getTime() });
      acc.entryPrices.push(entryPrice);
      acc.totalBoughtAmount += bought.amount;
      acc.totalBoughtUsd += swap.totalValueUsd ? swap.totalValueUsd : 0;
      acc.buyCount += 1;
    }

    // -- sold side: token exits wallet --
    if (!isBaseAsset(sold.address)) {
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
          totalBoughtAmount: 0,
          totalSoldAmount: 0,
          totalBoughtUsd: 0,
          totalSoldUsd: 0,
          longestHoldingTimeMs: null,
          maxTolerableLossPercent: null,
        };
        tokenMap.set(sold.address, acc);
      }

      const exitPrice = swap.totalValueUsd && sold.amount > 0 ? swap.totalValueUsd / sold.amount : 0;
      let remainingExit = sold.amount;
      acc.totalSoldAmount += sold.amount;
      acc.totalSoldUsd += swap.totalValueUsd ? swap.totalValueUsd : 0;
      acc.sellCount += 1;
      const sellTimeMs = new Date(swap.blockTimestampIso).getTime();
      const pnlBeforeSell = acc.realizedPnl;

      while (remainingExit > 0 && acc.entryQueue.length > 0) {
        const lot = acc.entryQueue[0];
        const matched = Math.min(remainingExit, lot.remaining);
        lot.remaining -= matched;
        remainingExit -= matched;

        const contribution = matched * (exitPrice - lot.price);
        acc.realizedPnl += contribution;

        const holdMs = sellTimeMs - lot.timestampMs;
        if (acc.longestHoldingTimeMs === null || holdMs > acc.longestHoldingTimeMs) {
          acc.longestHoldingTimeMs = holdMs;
        }

        const retPct = lot.price > 0 ? (exitPrice - lot.price) / lot.price : 0;
        if (retPct < 0) {
          if (acc.maxTolerableLossPercent === null || retPct < acc.maxTolerableLossPercent) {
            acc.maxTolerableLossPercent = retPct;
          }
        } else {
          acc.wins += 1;
        }
        acc.exits += 1;


        acc.exitPrices.push(exitPrice);

        if (lot.remaining <= 1e-12) {
          acc.entryQueue.shift();
        }
      }

      // if (acc.realizedPnl - pnlBeforeSell > 0) acc.wins += 1;
      // acc.exits += 1;

      // const retPct = acc.realizedPnl - pnlBeforeSell / pnlBeforeSell;
      // if (retPct < 0) {
      //   if (acc.maxTolerableLossPercent === null || retPct < acc.maxTolerableLossPercent) {
      //     acc.maxTolerableLossPercent = retPct;
      //   }
      // }
    }
  }

  return Array.from(tokenMap.values());
}

function buildBreakdown(acc: TokenAccumulator): TokenPnlBreakdownPersisted {
  return {
    address: acc.address,
    symbol: acc.symbol,
    name: acc.name,
    logoUri: acc.logoUri,
    pnlUsd: round2(acc.realizedPnl),
    trades: acc.buyCount + acc.sellCount,
    wins: acc.wins,
    exits: acc.exits,
    buyCount: acc.buyCount,
    sellCount: acc.sellCount,
    totalEntered: round2(acc.totalBoughtUsd),
    totalExited: round2(acc.totalSoldUsd),
    totalEnteredAmount: round2(acc.totalBoughtAmount),
    totalExitedAmount: round2(acc.totalSoldAmount),
    entryPrices: acc.entryPrices.length > 0 ? acc.entryPrices : null,
    exitPrices: acc.exitPrices.length > 0 ? acc.exitPrices : null,
    totalBoughtVolumeUsd: round2(acc.totalBoughtUsd),
    totalSoldVolumeUsd: round2(acc.totalSoldUsd),
    longestHoldingTimeMs: acc.longestHoldingTimeMs,
    maxTolerableLossPercent: acc.maxTolerableLossPercent !== null ? round2(acc.maxTolerableLossPercent * 100) : 0,
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

  const parsed = walletAiSwapSummaryResponseSchema.safeParse({
    address: row.address,
    language: row.language,
    ...row.response,
    model: row.model,
    fetchedAt: row.fetchedAt.toISOString(),
    cached: true,
  });

  if (!parsed.success) return null;

  return parsed.data;
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
let cachedGenAiClientKey: string | null = null;

function getGenAiClient(): GoogleGenAI {
  const key = getGoogleAiKey();
  if (!key) {
    throw new WalletAiSwapSummaryServiceError(
      "GOOGLE_AI_KEY is not configured on the server.",
      "model_error",
      502,
    );
  }
  if (!cachedGenAiClient || cachedGenAiClientKey !== key) {
    cachedGenAiClient = new GoogleGenAI({ apiKey: key });
    cachedGenAiClientKey = key;
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
