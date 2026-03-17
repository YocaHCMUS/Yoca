/**
 * Daily Trading Volume Chart API Route
 *
 * Endpoint for fetching daily trading volume (USD) per wallet.
 *
 * @module routes/charts/daily-trading-volume.route
 */

import { Hono } from "hono";
import { z } from "zod";
// Request Schema
import {
  getDailyTradingVolumeFromDb,
  type DailyTradingVolumeResponse,
} from "@sv/services/charts/dailyTradingVolume.service.js";

const dailyTradingVolumeRequestSchema = z.object({
  period: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  wallets: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").map((w) => w.trim()).filter(Boolean) : [])),
});
// Response Schemas
const dataPointSchema = z.object({
  date: z.string(),
  timestamp: z.number(),
  volume: z.number(),
  trades: z.number().optional(),
});

const dailyVolumeResponseSchema = z.object({
  data: z.array(dataPointSchema),
  totalVolume: z.number().optional(),
  metadata: z.object({
    period: z.string(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


const app = new Hono()
  /**
   * GET /api/charts/dailyTradingVolume
   *
   * Query parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet addresses
   */
  .get("/", async (c) => {
    try {
      const query = c.req.query();
      const params = dailyTradingVolumeRequestSchema.parse(query);

      const data: DailyTradingVolumeResponse = await getDailyTradingVolumeFromDb(
        params.period,
        params.wallets,
      );

      return c.json(data, 200);
    } catch (error) {
      console.error("[dailyTradingVolume.route] Error:", error);
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "Validation error",
            details: error.issues,
          },
          400,
        );
      }
      return c.json(
        {
          error: "Failed to fetch daily trading volume data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;

