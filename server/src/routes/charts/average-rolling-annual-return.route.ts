/**
 * Average Rolling Annual Return API Route
 * 
 * Endpoint for fetching average rolling annual return statistics by wallet
 * 
 * @module routes/charts/average-rolling-annual-return.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateAverageRollingAnnualReturn } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for average rolling annual return endpoint
 */
const averageRollingAnnualReturnRequestSchema = z.object({
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
  period: z.string().optional().default('1Y'),
  timeUnit: z.enum(['month', 'quarter', 'year', 'custom']).optional().default('month'),
  windowSize: z.string().optional().transform((val) => val ? parseInt(val, 10) : undefined),
});

/**
 * Average rolling annual return route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/average-rolling-annual-return
   * 
   * Fetch average rolling annual return statistics by wallet
   * 
   * Query Parameters:
   * - wallets: Comma-separated wallet addresses (optional, default: all wallets)
   * - period: Time period filter (default: '1Y')
   * - timeUnit: 'month' | 'quarter' | 'year' | 'custom' (default: 'month')
   * - windowSize: Window size in days for custom time unit (optional)
   * 
   * Response:
   * {
   *   wallets: Array<{
   *     walletAddress: string,
   *     walletName: string,
   *     returns: {
   *       min: number,
   *       q1: number,
   *       median: number,
   *       q3: number,
   *       max: number
   *     },
   *     averageReturn: number
   *   }>,
   *   metadata: {
   *     period: string,
   *     timeUnit: string,
   *     windowSize?: number,
   *     timestamp: number
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = averageRollingAnnualReturnRequestSchema.parse(query);
      
      // Generate average rolling annual return data
      const data = generateAverageRollingAnnualReturn(
        params.wallets,
        params.period,
        params.timeUnit,
        params.windowSize
      );
      
      // Return response
      return c.json(data);
    } catch (error) {
      console.error('Error fetching average rolling annual return data:', error);
      return c.json(
        { 
          error: 'Failed to fetch average rolling annual return data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
