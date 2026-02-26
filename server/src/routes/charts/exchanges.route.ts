/**
 * Exchange Comparison API Route
 *
 * Endpoint for fetching exchange comparison data
 *
 * @module routes/charts/exchanges.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateExchangeData } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for exchange comparison endpoint
 */
const exchangeRequestSchema = z.object({
  timePeriod: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  metric: z.enum(["count", "volume"]).optional().default("count"),
  timezone: z.string().optional().default("UTC"),
});

/**
 * Exchange comparison route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/exchanges
   *
   * Fetch exchange comparison data
   *
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - metric: 'count' | 'volume' (default: 'count')
   * - timezone: Timezone string (default: 'UTC')
   *
   * Response:
   * {
   *   exchanges: Array<{
   *     name: string,
   *     deposits: number,
   *     withdrawals: number,
   *     depositsVolume: number,
   *     withdrawalsVolume: number
   *   }>,
   *   metadata: {
   *     period: string,
   *     metric: string
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = exchangeRequestSchema.parse(query);

      // Generate exchange comparison data
      const data = generateExchangeData(params.timePeriod, params.metric);

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error("Error fetching exchange comparison data:", error);
      return c.json(
        {
          error: "Failed to fetch exchange comparison data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
