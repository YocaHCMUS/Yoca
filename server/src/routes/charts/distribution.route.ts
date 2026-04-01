/**
 * Distribution Chart API Route
 *
 * Endpoint for fetching asset distribution data with percentage calculations
 *
 * @module routes/charts/distribution.route
 */

import { Hono } from "hono";
import { z } from "zod";

import type { WalletPortfolioItem } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { getWalletPortfolio } from "@sv/services/wallet/walletPortfolio.service.js";
import { mapWithConcurrency } from "@sv/util/concurrency";

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
        const response = await mapWithConcurrency(
          walletAddresses,
          5,
          async (address: string) => {
            try {
              const portfolio = await getWalletPortfolio(address);
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

              return {
                walletAddress: address,
                data: distributionData,
                totalValue: totalValue,
              };
            } catch (err) {
              return {
                walletAddress: address,
                data: [],
                totalValue: 0,
                error: "Failed to fetch wallet portfolio"
              };
            }
          }
        );

        return c.json({
          wallets: response,
          metadata: {
            currency: 'USD',
            timestamp: Date.now()
          }
        });
      }

      // Return response
      return c.json(
        {
          error: "Wallet addresses are required",
          message: "Wallet addresses are required.",
        },
        400,
      );
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
  }
  );

export default app;
