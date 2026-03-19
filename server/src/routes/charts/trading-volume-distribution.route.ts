// Request Schema
/**
 * Trading Volume Distribution Chart API Route
 * 
 * Endpoint for fetching trading volume distribution data with percentage calculations
 * Shows trading volume distribution across different tokens for each wallet
 * 
 * @module routes/charts/trading-volume-distribution.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateTradingVolumeDistribution } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for trading volume distribution endpoint
 */
const tradingVolumeDistributionRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional(),
});

/**
 * Trading volume distribution chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/trading-volume-distribution
   * 
   * Fetch trading volume distribution data with percentage calculations per wallet
   * 
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet addresses (optional, default: single default wallet)
   * 
   * Response:
   * {
   *   wallets: Array<{
   *     walletAddress: string,
   *     data: Array<{ name: string, value: number, percentage: number, color?: string }>,
   *     totalVolume: number
   *   }>,
   *   metadata: { currency: string, timestamp: number }
   * }
   */
  .get('/', async (c) => {
    try {
      // Validate query parameters
      const query = c.req.query();
      const params = tradingVolumeDistributionRequestSchema.parse(query);

      // Generate trading volume distribution data
      const data = generateTradingVolumeDistribution(
        params.period,
        params.wallets
      );

      // Return response
      return c.json(data, 200);

    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return c.json({
          error: 'Validation error',
          details: error.issues,
        }, 400);
      }

      // Handle other errors
      console.error('[TradingVolumeDistributionChart] Error fetching trading volume distribution data:', error);
      return c.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

export default app;
