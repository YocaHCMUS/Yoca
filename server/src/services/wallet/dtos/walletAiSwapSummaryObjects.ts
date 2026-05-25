import { z } from "zod";

export const walletAiSwapSummaryRequestSchema = z.object({
  address: z.string().trim().min(1),
  language: z.enum(["en", "vn"]).default("en"),
});

export const tokenPnlBreakdownSchema = z.object({
  address: z.string().trim().min(1),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  logoUri: z.string().nullable(),
  pnlUsd: z.number(),
  trades: z.number().int().min(0),
  wins: z.number().int().min(0),
  buyCount: z.number().int().min(0),
  sellCount: z.number().int().min(0),
  totalEntered: z.number().min(0),
  totalExited: z.number().min(0),
  totalEnteredAmount: z.number().min(0),
  totalExitedAmount: z.number().min(0),
  entryPrices: z.array(z.number()).nullable(),
  exitPrices: z.array(z.number()).nullable(),
  totalBoughtVolumeUsd: z.number().min(0),
  totalSoldVolumeUsd: z.number().min(0),
  longestHoldingTimeMs: z.number().nullable(),
  maxTolerableLossPercent: z.number(),
});

export const walletAiSwapSummaryResponseSchema = z.object({
  address: z.string().trim().min(1),
  language: z.enum(["en", "vn"]),
  tradeCount: z.number().int().min(0),
  realizedPnlUsd: z.number(),
  winningPercentage: z.number().min(0).max(100),
  totalBoughtUsd: z.number().min(0),
  totalSoldUsd: z.number().min(0),
  topProfitable: tokenPnlBreakdownSchema.nullable(),
  topLoser: tokenPnlBreakdownSchema.nullable(),
  allTokenBreakdowns: z.array(tokenPnlBreakdownSchema),
  riskNotes: z.array(z.string().trim().min(1)),
  summary: z.string().trim().min(1),
  model: z.string().trim().min(1),
  fetchedAt: z.string().trim().min(1),
  cached: z.boolean(),
});

export type TokenPnlBreakdown = z.infer<typeof tokenPnlBreakdownSchema>;
export type WalletAiSwapSummaryResponse = z.infer<typeof walletAiSwapSummaryResponseSchema>;

export type WalletAiSwapSummaryErrorCode =
  | "invalid_address"
  | "no_data"
  | "model_error"
  | "invalid_model_response"
  | "provider_unknown";
