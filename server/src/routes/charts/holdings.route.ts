/**
 * Holding Durations API Route
 *
 * Endpoint for fetching token holding duration data
 *
 * @module routes/charts/holdings.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateHoldingDurations } from '../../services/mockChartData.service.js';
/**
 * Request parameter schema for holding durations endpoint
 */
const holdingRequestSchema = z.object({
  walletIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : [])),
  topN: z
    .string()
    .optional()
    .default("10")
    .transform((val) => parseInt(val, 10)),
  timeUnit: z.enum(["days", "weeks", "months"]).optional().default("days"),
  timezone: z.string().optional().default("UTC"),
});
// Response Schemas
const holdingItemSchema = z.object({
  tokenSymbol: z.string(),
  duration: z.number(),
  percentage: z.number().optional(),
  value: z.number().optional(),
}).passthrough();

const walletHoldingsSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  holdings: z.array(holdingItemSchema),
}).passthrough();

const holdingsResponseSchema = z.object({
  wallets: z.array(walletHoldingsSchema),
  metadata: z.object({
    timeUnit: z.string(),
    timezone: z.string(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Holding durations route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/holdings
   *
   * Fetch token holding duration data
   *
   * Query Parameters:
   * - walletIds: Comma-separated wallet IDs (optional, default: all wallets)
   * - topN: Number of top holdings to return (default: 10)
   * - timeUnit: 'days' | 'weeks' | 'months' (default: 'days')
   * - timezone: Timezone string (default: 'UTC')
   *
   * Response:
   * {
   *   wallets: Array<{
   *     id: string,
   *     name: string,
   *     holdings: Array<{
   *       tokenSymbol: string,
   *       durationDays: number
   *     }>
   *   }>,
   *   metadata: {
   *     unit: string
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = holdingRequestSchema.parse(query);

      // Generate holding durations data
      const data = generateHoldingDurations(
        params.walletIds,
        params.topN,
        params.timeUnit,
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error("Error fetching holding durations data:", error);
      return c.json(
        {
          error: "Failed to fetch holding durations data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
