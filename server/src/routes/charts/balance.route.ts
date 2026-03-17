/**
 * Balance Chart API Route
 *
 * Endpoint for fetching balance trend data with time-based aggregation
 *
 * @module routes/charts/balance.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateBalanceTrend } from '../../services/mockChartData.service.js';
import {
  getWalletBalanceHistory,
  getWalletTokenBalanceHistory,
  type BalanceDataPoint
} from '../../services/wallet/walletData.service.js';
import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";

/**
 * Request parameter schema for balance trend endpoint
 */
const balanceRequestSchema = z.object({
  timePeriod: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  tokens: z.string().optional(),
  wallets: z.string().optional(),
  timezone: z.string().optional().default("UTC"),
});
// Response Schemas
const dataPointSchema = z.object({
  timestamp: z.number(),
  value: z.number(),
});

const seriesSchema = z.object({
  name: z.string(),
  data: z.array(dataPointSchema),
  seriesType: z.enum(["line", "bar", "area"]),
  unit: z.enum(["USD", "TOKEN"]),
});

const balanceMetadataSchema = z.object({
  timePeriod: z.string(),
  aggregation: z.string(),
  dataPoints: z.number(),
  currency: z.string(),
  timezone: z.string(),
  mode: z.enum(["total", "token"]),
  tokens: z.array(z.string()),
  primaryYAxis: z.string(),
});

const balanceResponseSchema = z.object({
  series: z.array(seriesSchema),
  wallets: z.array(z.string()).optional(),
  metadata: balanceMetadataSchema,
});

const errorResponseSchema = z.object({
  error: z.string(),
  message: z.string().optional(),
});


/**
 * Balance chart route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/balance
   *
   * Fetch balance trend data with time-based aggregation
   *
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - tokens: Comma-separated token symbols (optional, default: all tokens)
   * - wallets: Comma-separated wallet addresses (optional)
   * - timezone: IANA timezone string (optional, default: 'UTC')
   *
   * Response:
   * {
   *   data: Array<{ timestamp: number, value: number }>,
   *   metadata: {
   *     timePeriod: string,
   *     tokens: string[] | undefined,
   *     aggregation: 'hourly' | 'daily' | 'weekly' | 'monthly',
   *     dataPoints: number
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      const query = c.req.query();
      console.log('[balance.route] Raw query:', query);

      const params = balanceRequestSchema.parse(query);
      console.log('[balance.route] Parsed params:', params);

      if (params.wallets) {
        const walletAddresses = params.wallets.split(',').map(w => w.trim()).filter(w => w !== '');
        const tokenSelectors = params.tokens
          ? params.tokens.split(',').map(t => t.trim()).filter(t => t !== '')
          : [];

        if (walletAddresses.length > 0) {
          try {
            const chain: SupportedChain = 'solana';

            if (tokenSelectors.length === 0) {
              const allHistories = await Promise.all(
                walletAddresses.map(addr => getWalletBalanceHistory(addr, chain, params.timePeriod))
              );

              const series = walletAddresses.length === 1
                ? [{
                  name: 'Total',
                  data: allHistories[0].map(point => ({ timestamp: point.timestamp, value: point.value })),
                  seriesType: 'line' as const,
                  unit: 'USD' as const,
                }]
                : walletAddresses.map((address, index) => ({
                  name: `${address.substring(0, 8)}...`,
                  data: allHistories[index].map(point => ({ timestamp: point.timestamp, value: point.value })),
                  seriesType: 'line' as const,
                  unit: 'USD' as const,
                }));

              return c.json({
                series,
                wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                metadata: {
                  timePeriod: params.timePeriod,
                  aggregation: 'daily',
                  dataPoints: allHistories[0]?.length ?? 0,
                  currency: 'USD',
                  timezone: params.timezone || 'UTC',
                  mode: 'total' as const,
                  tokens: [],
                  primaryYAxis: 'USD' as const,
                },
              }, 200);
            }

            const pairs = walletAddresses.flatMap(addr =>
              tokenSelectors.map(token => ({ addr, token }))
            );

            const pairResults = await Promise.all(
              pairs.map(({ addr, token }) =>
                getWalletTokenBalanceHistory(addr, chain, token, params.timePeriod)
              )
            );

            const series = pairs.flatMap(({ addr, token }, index) => {
              const result = pairResults[index];
              const prefix = walletAddresses.length > 1 ? `${addr.substring(0, 8)}... ` : '';
              const tokenUnit: any = {
                name: `${prefix}${result.tokenSymbol} (units)`,
                data: result.tokenSeries.map(point => ({ timestamp: point.timestamp, value: point.value })),
                seriesType: 'line' as const,
                unit: 'TOKEN' as const,
              };
              const usdSeries: any = {
                name: `${prefix}${result.tokenSymbol} (USD)`,
                data: result.usdSeries.map(point => ({ timestamp: point.timestamp, value: point.value })),
                seriesType: 'bar' as const,
                unit: 'USD' as const,
              };
              return [tokenUnit, usdSeries];
            });

            return c.json({
              series,
              wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
              metadata: {
                timePeriod: params.timePeriod,
                aggregation: 'daily',
                dataPoints: pairResults[0]?.tokenSeries.length ?? 0,
                currency: 'USD',
                timezone: params.timezone || 'UTC',
                mode: 'token' as const,
                tokens: tokenSelectors,
                primaryYAxis: 'TOKEN' as const,
              },
            }, 200);
          } catch (error) {
            console.error("[BalanceChart] Error fetching wallet balance history:", error);
            const data = generateBalanceTrend(params.timePeriod, params.tokens, params.wallets);
            return c.json(data, 200);
          }
        }
      }

      const data = generateBalanceTrend(params.timePeriod, params.tokens, params.wallets);
      return c.json(data, 200);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return c.json({ error: "Validation error", details: error.issues }, 400);
      }
      console.error("[BalanceChart] Error fetching balance data:", error);
      return c.json(
        { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
        500,
      );
    }
  });

export default app;
