// Request Schema
/**
 * Trading Volume Per Transaction Chart API Route
 * 
 * Endpoint for fetching trading volume per transaction data as box plots
 * Shows statistical distribution of transaction volumes for deposits and withdrawals per wallet
 * 
 * @module routes/charts/trading-volume-per-transaction.route
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { generateTradingVolumePerTransaction } from '../../services/mockChartData.service.js';

/**
 * Request parameter schema for trading volume per transaction endpoint
 */
const tradingVolumePerTransactionRequestSchema = z.object({
  period: z.enum(['7D', '30D', '60D', '90D', '1Y', 'All']).optional().default('30D'),
  wallets: z.string().optional(),
  type: z.enum(['all', 'deposits', 'withdrawals']).optional().default('all'),
});
// Response Schemas
const dataPointSchema = z.object({
  timestamp: z.number(),
  averageVolume: z.number(),
  medianVolume: z.number().optional(),
  minVolume: z.number().optional(),
  maxVolume: z.number().optional(),
  transactionCount: z.number().optional(),
});

const volumePerTransactionResponseSchema = z.object({
  data: z.array(dataPointSchema),
  overallAverage: z.number().optional(),
  metadata: z.object({
    period: z.string(),
    aggregation: z.string(),
    currency: z.string().optional(),
  }).passthrough(),
}).passthrough();

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Trading volume per transaction chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/trading-volume-per-transaction
   * 
   * Fetch trading volume per transaction data as box plots per wallet
   * 
   * Query Parameters:
   * - period: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - wallets: Comma-separated wallet addresses (optional, default: single default wallet)
   * - type: 'all' | 'deposits' | 'withdrawals' (default: 'all')
   * 
   * Response:
   * {
   *   wallets: Array<{
   *     walletAddress: string,
   *     walletName: string,
   *     deposit: { min, q1, median, q3, max },
   *     withdraw: { min, q1, median, q3, max },
   *     transactionCount: number
   *   }>,
   *   metadata: { currency: string, period: string, timestamp: number }
   * }
   */
  .get('/', async (c) => {
    try {
      // Validate query parameters
      const query = c.req.query();
      const params = tradingVolumePerTransactionRequestSchema.parse(query);

      // Generate trading volume per transaction data
      const data = generateTradingVolumePerTransaction(
        params.period,
        params.wallets,
        params.type
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
      console.error('[TradingVolumePerTransactionChart] Error fetching trading volume per transaction data:', error);
      return c.json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }, 500);
    }
  });

export default app;
