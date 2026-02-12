/**
 * Distribution Chart API Route
 * 
 * Endpoint for fetching asset distribution data with percentage calculations
 * 
 * @module routes/charts/distribution.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateAssetDistribution } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for distribution endpoint
 */
const distributionRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional(),
});

/**
 * Distribution chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/distribution
   * 
   * Fetch asset distribution data with percentage calculations
   * 
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet addresses (optional, default: all wallets)
   * 
   * Response (single/aggregated):
   * {
   *   data: Array<{ name: string, value: number, percentage: number, color?: string }>,
   *   totalValue: number,
   *   metadata: { currency: string, timestamp: number }
   * }
   * 
   * Response (multiple wallets):
   * {
   *   wallets: Array<{
   *     walletAddress: string,
   *     data: Array<{ name: string, value: number, percentage: number, color?: string }>,
   *     totalValue: number
   *   }>,
   *   metadata: { currency: string, timestamp: number }
   * }
   */
  .get('/', async (c) => {
    try {
      // Validate query parameters
      const query = c.req.query();
      const params = distributionRequestSchema.parse(query);
      
      // Generate asset distribution data
      const data = generateAssetDistribution(
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
      console.error('[DistributionChart] Error fetching distribution data:', error);
      return c.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

export default app;
