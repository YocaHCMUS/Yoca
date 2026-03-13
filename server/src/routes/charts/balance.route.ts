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
      // Validate query parameters
      const query = c.req.query();
      console.log('[balance.route] Raw query:', query);
      
      const params = balanceRequestSchema.parse(query);
      console.log('[balance.route] Parsed params:', params);

      // If wallets parameter is provided, fetch actual balance history
      if (params.wallets) {
        const walletAddresses = params.wallets.split(',').map(w => w.trim()).filter(w => w !== '');
        
        if (walletAddresses.length > 0) {
          try {
            // For single wallet, return direct data
            if (walletAddresses.length === 1) {
              const address = walletAddresses[0];
              const chain: SupportedChain = 'solana'; // Default chain
              
              const balanceHistory = await getWalletBalanceHistory(
                address, 
                chain, 
                params.timePeriod
              );
              
              // Format response to match client expectations (series structure)
              const seriesName = params.tokens || 'Total';
              
              return c.json({
                series: [
                  {
                    name: seriesName,
                    data: balanceHistory.map(point => ({
                      timestamp: point.timestamp,
                      value: point.value,
                    })),
                  }
                ],
                wallets: undefined, // Single wallet, not shown in legend
                metadata: {
                  timePeriod: params.timePeriod,
                  aggregation: 'daily',
                  dataPoints: balanceHistory.length,
                  currency: 'USD',
                  timezone: params.timezone || 'UTC',
                },
              }, 200);
            }
            
            // For multiple wallets, create series for each wallet
            const chain: SupportedChain = 'solana';
            const allHistories = await Promise.all(
              walletAddresses.map(addr => 
                getWalletBalanceHistory(addr, chain, params.timePeriod)
              )
            );
            
            // Build series array (one per wallet)
            const series = walletAddresses.map((address, index) => {
              const history = allHistories[index];
              return {
                name: `${address.substring(0, 8)}...`, // Shortened address for legend
                data: history.map(point => ({
                  timestamp: point.timestamp,
                  value: point.value,
                })),
              };
            });
            
            return c.json({
              series,
              wallets: walletAddresses,
              metadata: {
                timePeriod: params.timePeriod,
                aggregation: 'daily',
                dataPoints: allHistories[0]?.length ?? 0,
                currency: 'USD',
                timezone: params.timezone || 'UTC',
              },
            }, 200);
          } catch (error) {
            console.error("[BalanceChart] Error fetching wallet balance history:", error);
            // Fall back to mock data on error
            const data = generateBalanceTrend(
              params.timePeriod,
              params.tokens,
              params.wallets,
            );
            return c.json(data, 200);
          }
        }
      }

      // Generate balance trend data (mock) if no wallets specified
      const data = generateBalanceTrend(
        params.timePeriod,
        params.tokens,
        params.wallets,
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return c.json(
          {
            error: "Validation error",
            details: error.issues,
          },
          400,
        );
      }

      // Handle other errors
      console.error("[BalanceChart] Error fetching balance data:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
