/**
 * Stablecoin Ratio Chart API Route
 * 
 * Endpoint for fetching stablecoin ratio time series data
 * 
 * @module routes/charts/stablecoin-ratio.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateStablecoinRatioData } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for stablecoin ratio endpoint
 */
const stablecoinRatioRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
});

/**
 * Stablecoin ratio chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/stablecoin-ratio
   * 
   * Fetch stablecoin ratio time series data
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
   *     data: Array<{ timestamp: number, value: number }>,
   *     currentRatio: number,
   *     averageRatio: number
   *   }>,
   *   metadata: { period: string, timestamp: number, currency: string }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = stablecoinRatioRequestSchema.parse(query);
      
      // Generate stablecoin ratio data
      const data = generateStablecoinRatioData(
        params.wallets,
        params.period
      );
      
      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error('Error fetching stablecoin ratio data:', error);
      return c.json(
        { 
          error: 'Failed to fetch stablecoin ratio data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
