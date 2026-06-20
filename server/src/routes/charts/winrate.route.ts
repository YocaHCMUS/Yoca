/**
 * Winrate Chart API Route
 *
 * Endpoint for fetching winrate and trade magnitude distribution data
 *
 * @module routes/charts/winrate.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { getWinrateData } from '@sv/services/charts/winrate.service.js';

const winrateRequestSchema = z.object({
  period: z.enum(['24H', '7D', '30D', '90D']).optional().default('30D'),
  wallets: z.string().optional().transform((val) => val ? val.split(',').filter(Boolean) : []),
});

const app = new Hono()
  .get('/', async (c) => {
    try {
      const query = c.req.query();
      const params = winrateRequestSchema.parse(query);

      const data = await getWinrateData(
        params.wallets,
        params.period,
      );

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
