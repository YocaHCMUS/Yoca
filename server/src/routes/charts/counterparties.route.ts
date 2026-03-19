/**
 * Counterparty Activity API Route
 *
 * Endpoint for fetching counterparty activity data
 *
 * @module routes/charts/counterparties.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateCounterpartyData } from '../../services/mockChartData.service.js';
import { getWalletCounterparties } from "@sv/services/wallet/counterparties.service.js";

/**
 * Request parameter schema for counterparty activity endpoint
 */
const counterpartyRequestSchema = z.object({
  timePeriod: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  transactionType: z
    .enum(["all", "deposits", "withdrawals", "trades"])
    .optional()
    .default("all"),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => parseInt(val, 10)),
  timezone: z.string().optional().default("UTC"),
  wallets: z.string().optional(),
  address: z.string().optional(),
  period: z.string().optional(),
});

function clampLimit(rawLimit: number): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  const integerLimit = Math.floor(parsed);
  if (integerLimit < 1) {
    return 1;
  }

  if (integerLimit > 100) {
    return 100;
  }

  return integerLimit;
}

function extractWalletAddress(params: { address?: string; wallets?: string }): string | null {
  const directAddress = String(params.address ?? "").trim();
  if (directAddress) {
    return directAddress;
  }

  const walletsRaw = String(params.wallets ?? "").trim();
  if (!walletsRaw) {
    return null;
  }

  const firstWallet = walletsRaw
    .split(",")
    .map((entry) => entry.trim())
    .find((entry) => entry.length > 0);

  return firstWallet ?? null;
}

function mapChartPeriodToWalletPeriod(rawPeriod?: string): "24h" | "7d" {
  const normalized = String(rawPeriod ?? "").trim().toLowerCase();
  if (normalized === "24h") {
    return "24h";
  }

  if (normalized === "7d") {
    return "7d";
  }

  return "7d";
}

/**
 * Counterparty activity route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/counterparties
   *
   * Fetch counterparty activity data
   *
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - transactionType: 'all' | 'deposits' | 'withdrawals' | 'trades' (default: 'all')
   * - limit: Number of top counterparties to return (default: 10)
   * - timezone: Timezone string (default: 'UTC')
   *
   * Response:
   * {
   *   counterparties: Array<{
   *     id: string,
   *     name: string,
   *     transactionCount: number,
   *     totalVolume: number
   *   }>,
   *   metadata: {
   *     period: string,
   *     transactionType: string,
   *     limit: number
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = counterpartyRequestSchema.parse(query);

      const walletAddress = extractWalletAddress({
        address: params.address,
        wallets: params.wallets,
      });
      const limit = clampLimit(params.limit);

      // Wallet-aware compatibility path for production-backed chart consumers.
      if (walletAddress) {
        const walletPeriod =
          params.period != null
            ? mapChartPeriodToWalletPeriod(params.period)
            : "7d";

        const walletCounterparties = await getWalletCounterparties(
          walletAddress,
          {
            period: walletPeriod,
            limit,
            includeTokens: true,
          },
        );

        const byTransactionCount = walletCounterparties.rankings.byTransactionCount.map((item) => ({
          id: item.address,
          name: item.label,
          transactionCount: item.transactionCount,
          totalVolume: item.totalVolumeUsd,
        }));

        const byVolume = walletCounterparties.rankings.byVolume.map((item) => ({
          id: item.address,
          name: item.label,
          transactionCount: item.transactionCount,
          totalVolume: item.totalVolumeUsd,
        }));

        return c.json(
          {
            counterparties: byTransactionCount,
            counterpartiesByTransactionCount: byTransactionCount,
            counterpartiesByVolume: byVolume,
            metadata: {
              period: walletCounterparties.metadata.period.toUpperCase(),
              transactionType: params.transactionType,
              limit,
              source: walletCounterparties.metadata.source,
            },
          },
          200,
        );
      }

      // Generate counterparty activity data
      const data = generateCounterpartyData(
        params.timePeriod,
        params.transactionType,
        limit,
      );

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error("Error fetching counterparty activity data:", error);
      return c.json(
        {
          error: "Failed to fetch counterparty activity data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
