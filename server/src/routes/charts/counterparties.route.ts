/**
 * Counterparty Activity API Route
 *
 * Endpoint for fetching counterparty activity data
 *
 * @module routes/charts/counterparties.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateCounterpartyData } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for counterparty activity endpoint
 */
const counterpartyRequestSchema = z.object({
  timePeriod: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  transactionType: z
    .enum(["all", "deposits", "withdrawals", "trades"])
    .optional()
    .default("all"),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => parseInt(val, 10)),
  timezone: z.string().optional().default("UTC"),
});

/**
 * Counterparty activity route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/counterparties
   *
   * Fetch counterparty activity data
   *
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - transactionType: 'all' | 'deposits' | 'withdrawals' | 'trades' (default: 'all')
   * - limit: Number of top counterparties to return (default: 10)
   * - timezone: Timezone string (default: 'UTC')
   *
   * Response:
   * {
   *   counterparties: Array<{
   *     id: string,
   *     name: string,
   *     transactionCount: number,
   *     totalVolume: number
   *   }>,
   *   metadata: {
   *     period: string,
   *     transactionType: string,
   *     limit: number
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = counterpartyRequestSchema.parse(query);

      // Generate counterparty activity data
      const data = generateCounterpartyData(
        params.timePeriod,
        params.transactionType,
        params.limit,
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error("Error fetching counterparty activity data:", error);
      return c.json(
        {
          error: "Failed to fetch counterparty activity data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
