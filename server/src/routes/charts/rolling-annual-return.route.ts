// Request Schema
/**
 * Rolling Annual Return API Route
 * 
 * Endpoint for fetching rolling annual return data with cumulative values
 * 
 * @module routes/charts/rolling-annual-return.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getRollingAnnualReturns } from '@sv/services/wallet/walletComparison.js';

/**
 * Request parameter schema for rolling annual return endpoint
 */
const rollingAnnualReturnRequestSchema = z.object({
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
  period: z.enum(['7D', '30D', '90D', 'All']).optional().default('30D'),
  timeUnit: z.enum(['month', 'quarter', 'year', 'custom']).optional().default('month'),
  windowSize: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
  timezone: z.string().optional().default('UTC'),
});


/**
 * Rolling annual return route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/rolling-annual-return
   * 
   * Fetch rolling annual return data with cumulative values
   * 
   * Query Parameters:
   * - wallets: Comma-separated wallet addresses (optional, default: all wallets)
   * - period: Time period filter (default: '1Y')
   * - timeUnit: 'month' | 'quarter' | 'year' | 'custom' (default: 'month')
   * - windowSize: Window size in days for custom time unit (optional)
   * - timezone: Timezone string (default: 'UTC')
   * 
   * Response:
   * {
   *   rollingReturn: Array<{ timestamp: number, value: number }>,
   *   cumulativeReturn: Array<{ timestamp: number, value: number }>,
   *   metadata: {
   *     currency: string,
   *     timeUnit: string,
   *     windowSize?: number,
   *     startReturn: number,
   *     endReturn: number,
   *     totalReturnPercent: number
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = rollingAnnualReturnRequestSchema.parse(query);

      // Fetch rolling annual returns from wallet comparison service
      const data = await getRollingAnnualReturns(
        params.wallets,
        params.period,
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error('Error fetching rolling annual return data:', error);
      return c.json(
        {
          error: 'Failed to fetch rolling annual return data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
