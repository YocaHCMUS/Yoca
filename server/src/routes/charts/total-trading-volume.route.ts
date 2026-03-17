// Request Schema
/**
 * Total Trading Volume Chart API Route
 * 
 * Endpoint for fetching total trading volume ranking data
 * 
 * @module routes/charts/total-trading-volume.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getTotalTradingVolumeFromDb } from '@sv/services/charts/totalTradingVolume.service.js';

/**
 * Request parameter schema for total trading volume endpoint
 */
const totalTradingVolumeRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
});
// Response Schemas
const dataPointSchema = z.object({
  timestamp: z.number(),
  volume: z.number(),
  trades: z.number().optional(),
});

const totalVolumeResponseSchema = z.object({
  data: z.array(dataPointSchema),
  totalVolume: z.number().optional(),
  metadata: z.object({
    period: z.string(),
    aggregation: z.string(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Total trading volume chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/total-trading-volume
   * 
   * Fetch total trading volume ranking data
   * 
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet IDs (optional)
   * 
   * Response:
   * {
   *   wallets: Array<{
   *     walletAddress: string,
   *     walletName: string,
   *     totalVolume: number,
   *     depositVolume: number,
   *     withdrawalVolume: number,
   *     tradeCount: number,
   *     rank: number
   *   }>,
   *   metadata: { period: string, timestamp: number, currency: string }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = totalTradingVolumeRequestSchema.parse(query);

      const data = await getTotalTradingVolumeFromDb(
        params.wallets,
        params.period
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error('Error fetching total trading volume data:', error);
      return c.json(
        {
          error: 'Failed to fetch total trading volume data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
