// Request Schema
/**
 * Drawdown Chart API Route
 * 
 * Endpoint for fetching drawdown data
 * 
 * @module routes/charts/drawdown.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateDrawdownData } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for drawdown endpoint
 */
const drawdownRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
});

/**
 * Drawdown chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/drawdown
   * 
   * Fetch drawdown chart data
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
   *     maxDrawdown: number,
   *     maxDrawdownTimestamp: number,
   *     daysSinceMaxDrawdown: number,
   *     currentDrawdown: number
   *   }>,
   *   metadata: { period: string, timestamp: number, currency: string }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = drawdownRequestSchema.parse(query);

      // Generate drawdown data
      const data = generateDrawdownData(
        params.wallets,
        params.period
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error('Error fetching drawdown data:', error);
      return c.json(
        {
          error: 'Failed to fetch drawdown data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
