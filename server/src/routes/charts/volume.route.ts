/**
 * Volume Benchmark API Route
 * 
 * Endpoint for fetching volume benchmark comparison data
 * 
 * @module routes/charts/volume.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateVolumeBenchmark } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for volume benchmark endpoint
 */
const volumeRequestSchema = z.object({
  timePeriod: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  walletIds: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
  timezone: z.string().optional().default('UTC'),
});

/**
 * Volume benchmark route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/volume
   * 
   * Fetch volume benchmark comparison data
   * 
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - walletIds: Comma-separated wallet IDs (optional, default: all wallets)
   * - timezone: Timezone string (default: 'UTC')
   * 
   * Response:
   * {
   *   wallets: Array<{
   *     id: string,
   *     name: string,
   *     dataPoints: Array<{ timestamp: number, volume: number }>
   *   }>,
   *   metadata: {
   *     period: string,
   *     currency: string,
   *     timezone: string
   *   }
   * }
   */
  .get('/', async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = volumeRequestSchema.parse(query);
      
      // Generate volume benchmark data
      const data = generateVolumeBenchmark(
        params.timePeriod,
        params.walletIds,
        params.timezone
      );
      
      // Return response
      return c.json(data);
    } catch (error) {
      console.error('Error fetching volume benchmark data:', error);
      return c.json(
        { 
          error: 'Failed to fetch volume benchmark data',
          message: error instanceof Error ? error.message : 'Unknown error'
        },
        500
      );
    }
  });

export default app;
