/**
 * Distribution Chart API Route
 *
 * Endpoint for fetching asset distribution data with percentage calculations
 *
 * @module routes/charts/distribution.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateAssetDistribution } from "@sv/services/mockChartData.service.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletData.service.js";
import type { SupportedChain, WalletPortfolioItem } from "@sv/services/wallet/dtos/walletDataObjects.js";

/**
 * Request parameter schema for distribution endpoint
 */
const distributionRequestSchema = z.object({
  period: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
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
  .get("/", async (c) => {
    try {
      // Validate query parameters
      const query = c.req.query();
      const params = distributionRequestSchema.parse(query);

      // If wallets parameter is provided, fetch actual portfolio data
      if (params.wallets) {
        const walletAddresses = params.wallets.split(',').map(w => w.trim()).filter(w => w !== '');

        // For single wallet, return aggregated data
        if (walletAddresses.length === 1) {
          const address = walletAddresses[0];
          const chain: SupportedChain = 'solana'; // Default chain

          try {
            const portfolio = await getWalletPortfolio(address, chain);

            // Transform portfolio data into distribution format
            const totalValue = portfolio.reduce((sum: number, item: WalletPortfolioItem) => sum + (item.valueUsd ?? 0), 0);

            const distributionData = portfolio.map((item: WalletPortfolioItem) => ({
              name: item.symbol || item.name || item.tokenAddress || "Unknown",
              value: item.valueUsd ?? 0,
              percentage: totalValue > 0 ? ((item.valueUsd ?? 0) / totalValue) * 100 : 0,
              rawAmount: item.amount ?? 0,
              tokenAddress: item.tokenAddress ?? "",
              symbol: item.symbol ?? "",
              logoUri: item.logoUri ?? undefined,
            }));

            return c.json({
              data: distributionData,
              totalValue: totalValue,
              address: address,
              chain: chain,
              metadata: {
                currency: 'USD',
                timestamp: Date.now()
              }
            });
          } catch (err) {
            console.error("Failed to fetch wallet portfolio for distribution", err);
            // Fall back to mock data on error
            const data = generateAssetDistribution(params.period, params.wallets);
            return c.json(data, 200);
          }
        }

        // For multiple wallets, fall back to mock data generation
        const data = generateAssetDistribution(params.period, params.wallets);
        return c.json(data, 200);
      }

      // Generate asset distribution data (mock)
      const data = generateAssetDistribution(params.period, params.wallets);

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
      console.error(
        "[DistributionChart] Error fetching distribution data:",
        error,
      );
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
