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
import { getTradingVolumes } from '@sv/services/wallet/walletComparison.js';

/**
 * Request parameter schema for total trading volume endpoint
 */
const totalTradingVolumeRequestSchema = z.object({
  period: z.enum(['24H', '7D', '30D', '90D', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
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
   * - period: '24H' | '7D' | '30D' | '90D' | 'All' (default: '30D')
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

      // Fetch total trading volumes from wallet comparison service
      const data = await getTradingVolumes(
        params.wallets,
        params.period,
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
