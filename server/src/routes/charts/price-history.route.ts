/**
 * Price History Chart API Route
 *
 * Endpoint for fetching price history data for tokens
 *
 * @module routes/charts/price-history.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateMockPriceHistory } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for price history endpoint
 */
const priceHistoryRequestSchema = z.object({
  tokens: z.string().optional(),
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  aggregation: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional().default('daily'),
});

/**
 * Price history chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/price-history
   *
   * Fetch price history data for specified tokens
   *
   * Query Parameters:
   * - tokens: Comma-separated token symbols (optional, default: SOL,JTO,BONK,JUP,WIF)
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly' (default: 'daily')
   *
   * Response:
   * {
   *   series: Array<{
   *     symbol: string,
   *     name: string,
   *     data: Array<{ timestamp: number, value: number }>
   *   }>,
   *   metadata: {
   *     currency: string,
   *     timezone: string,
   *     aggregation: string,
   *     timestamp: number
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const queryParams = c.req.query();
      const validatedParams = priceHistoryRequestSchema.parse(queryParams);

      // Extract parameters
      const tokens = validatedParams.tokens ? validatedParams.tokens.split(',') : [];
      const period = validatedParams.period;
      const aggregation = validatedParams.aggregation;

      // Generate mock data
      const series = generateMockPriceHistory(tokens, period, aggregation);

      // Return response
      return c.json({
        series,
        metadata: {
          currency: 'USD',
          timezone: 'UTC',
          aggregation,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error('Error fetching price history:', error);

      if (error instanceof z.ZodError) {
        return c.json({ error: 'Invalid query parameters', details: error.issues }, 400);
      }

      return c.json({ error: 'Internal server error' }, 500);
    }
  });

export default app;