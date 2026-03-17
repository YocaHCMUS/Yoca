// Request Schema
/**
 * Winrate Chart API Route
 * 
 * Endpoint for fetching winrate and trade magnitude distribution data
 * 
 * @module routes/charts/winrate.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateWinrateData } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for winrate endpoint
 */
const winrateRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
});
// Response Schemas
const winrateResponseSchema = z.object({
  data: z.object({
    winCount: z.number(),
    lossCount: z.number(),
    winrate: z.number(),
    winAmount: z.number().optional(),
    lossAmount: z.number().optional(),
  }).passthrough(),
  metadata: z.object({
    period: z.string(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Winrate chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/winrate
   * 
   * Fetch winrate and trade magnitude distribution data
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
   *     winrate: number,
   *     totalTrades: number,
   *     winningTrades: number,
   *     losingTrades: number,
   *     winningDistribution: Array<{ range: string, count: number, min: number, max: number }>,
   *     losingDistribution: Array<{ range: string, count: number, min: number, max: number }>
   *   }>,
   *   metadata: { period: string, timestamp: number }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = winrateRequestSchema.parse(query);

      // Generate winrate data
      const data = generateWinrateData(
        params.wallets,
        params.period
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error('Error fetching winrate data:', error);
      return c.json(
        {
          error: 'Failed to fetch winrate data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
