/**
 * Transaction Distribution API Route
 * 
 * Endpoint for fetching transaction distribution data
 * 
 * @module routes/charts/transactions.route
 */

import { Hono } from "hono";
import { z } from "zod";
// Request Schema
import { getTransactionDistributionFromDb } from "@sv/services/wallet/transactionDistribution.service.js";

/**
 * Request parameter schema for transaction distribution endpoint
 */
const transactionRequestSchema = z.object({
  timePeriod: z.enum(["7D", "30D", "60D", "90D", "1Y", "All"]).optional().default("30D"),
  transactionType: z
    .enum(["all", "deposits", "withdrawals", "trades"])
    .optional()
    .default("all"),
  walletIds: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(",").filter(Boolean) : [])),
  timezone: z.string().optional().default("UTC"),
});
// Response Schemas
const dataPointSchema = z.object({
  timestamp: z.number(),
  value: z.number(),
  details: z.record(z.any()).optional(),
});

const transactionsResponseSchema = z.object({
  data: z.array(dataPointSchema),
  metadata: z.object({
    period: z.string(),
    dataPoints: z.number(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Transaction distribution route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/transactions
   * 
   * Fetch transaction distribution data
   * 
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - transactionType: 'all' | 'deposits' | 'withdrawals' | 'trades' (default: 'all')
   * - walletIds: Comma-separated wallet IDs (optional, default: all wallets)
   * - timezone: Timezone string (default: 'UTC')
   * 
   * Response:
   * {
   *   transactionCounts: Array<{
   *     walletId: string,
   *     walletName: string,
   *     data: Array<{ timestamp: number, value: number }>
   *   }>,
   *   uniqueTokenCounts: Array<{ timestamp: number, value: number }>,
   *   metadata: {
   *     period: string,
   *     transactionType: string
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = transactionRequestSchema.parse(query);

      // Build chart data from cached wallet transactions in DB.
      const data = await getTransactionDistributionFromDb(
        params.timePeriod,
        params.transactionType,
        params.walletIds,
      );

      return c.json(data);
    } catch (error) {
      console.error('Error fetching transaction distribution data:', error);
      return c.json(
        {
          error: 'Failed to fetch transaction distribution data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
