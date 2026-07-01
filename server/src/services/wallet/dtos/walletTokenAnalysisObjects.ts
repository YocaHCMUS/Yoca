import { z } from "zod";

export const tokenTradeEventSchema = z.object({
  timestampMs: z.number(),
  type: z.enum(["buy", "sell"]),
  price: z.number(),
  amount: z.number(),
  valueUsd: z.number(),
  pnlUsd: z.number().optional(),
  pnlPercent: z.number().optional(),
  holdingTimeMs: z.number().optional(),
});

export type TokenTradeEvent = z.infer<typeof tokenTradeEventSchema>;

export const tokenPnlDistributionSchema = z.object({
  extremeProfit: z.number().int().min(0),
  highProfit: z.number().int().min(0),
  profit: z.number().int().min(0),
  lowLoss: z.number().int().min(0),
  highLoss: z.number().int().min(0),
});

export type TokenPnlDistribution = z.infer<typeof tokenPnlDistributionSchema>;

export const tokenDeepAnalysisRequestSchema = z.object({
  address: z.string().trim().min(1),
  tokenAddress: z.string().trim().min(1),
  language: z.enum(["en", "vn"]).default("en"),
});

export type TokenDeepAnalysisRequest = z.infer<typeof tokenDeepAnalysisRequestSchema>;

export const tokenDeepAnalysisResponseSchema = z.object({
  address: z.string(),
  tokenAddress: z.string(),
  symbol: z.string().nullable(),
  name: z.string().nullable(),
  logoUri: z.string().nullable(),
  analysis: z.string().min(1),
  riskNotes: z.array(z.string()),
  tradeCount: z.number().int().min(0),
  realizedPnlUsd: z.number(),
  totalBoughtUsd: z.number().min(0),
  totalSoldUsd: z.number().min(0),
  tradeTimeline: z.array(tokenTradeEventSchema),
  pnlDistribution: tokenPnlDistributionSchema,
  winningPercentage: z.number().min(0).max(100),
  model: z.string().min(1),
  cached: z.boolean(),
});

export type TokenDeepAnalysisResponse = z.infer<typeof tokenDeepAnalysisResponseSchema>;

export type TokenDeepAnalysisErrorCode =
  | "invalid_address"
  | "invalid_token"
  | "no_data"
  | "model_error"
  | "invalid_model_response"
  | "provider_unknown";
