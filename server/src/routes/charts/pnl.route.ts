/**
 * P&L Chart API Route
 *
 * Endpoint for fetching profit and loss data
 *
 * @module routes/charts/pnl.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { getHistoricalPnLData } from '../../services/charts/pnlChart.service.js';

/**
 * Request parameter schema for P&L endpoint
 */
const pnlRequestSchema = z.object({
  period: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  wallets: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : [])),
  aggregation: z
    .enum(["daily", "weekly", "monthly"])
    .optional()
    .default("daily"),
});

/**
 * P&L chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/pnl
   *
   * Fetch profit and loss chart data
   *
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet IDs (optional)
   * - aggregation: 'daily' | 'weekly' | 'monthly' (default: 'daily')
   *
   * Response:
   * {
   *   dailyPnL: Array<{ timestamp: number; value: number }>,
   *   cumulativePnL: Array<{ timestamp: number; value: number }>,
   *   metadata: {
   *     currency: string,
   *     startBalance: number,
   *     endBalance: number
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      const query = c.req.query();
      const params = pnlRequestSchema.parse(query);

      const data = await getHistoricalPnLData(
        params.wallets,
        params.period,
        params.aggregation,
      );

      return c.json(data, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "Validation error",
            details: error.issues,
          },
          400,
        );
      }

      console.error("Error fetching P&L data:", error);
      return c.json(
        {
          error: "Failed to fetch P&L data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
