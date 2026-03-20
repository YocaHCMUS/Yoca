/**
 * Exchange Comparison API Route
 *
 * Endpoint for fetching exchange comparison data
 *
 * @module routes/charts/exchanges.route
 */

import { Hono } from "hono";
import { z } from "zod";
// Request Schema
import { generateExchangeData } from '../../services/mockChartData.service.js';
import { getWalletExchangeCounts } from "@sv/services/wallet/walletData.service.js";

/**
 * Request parameter schema for exchange comparison endpoint
 */
const exchangeRequestSchema = z.object({
  timePeriod: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional()
    .default("30D"),
  period: z
    .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
    .optional(),
  metric: z.enum(["count", "volume"]).optional().default("count"),
  timezone: z.string().optional().default("UTC"),
  wallets: z.string().optional(),
  address: z.string().optional(),
  chain: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default("10")
    .transform((val) => Number.parseInt(val, 10)),
});

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

function normalizePeriod(params: {
  period?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
  timePeriod?: "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
}): "7D" | "30D" | "60D" | "90D" | "1Y" | "All" {
  return params.period ?? params.timePeriod ?? "30D";
}

/**
 * Exchange comparison route handler
 */
const app = new Hono()
  /**
   * GET /api/charts/exchanges
   *
   * Fetch exchange comparison data
   *
   * Query Parameters:
   * - timePeriod: '7D' | '30D' | '60D' | '90D' | '1Y' | 'All' (default: '30D')
   * - metric: 'count' | 'volume' (default: 'count')
   * - timezone: Timezone string (default: 'UTC')
   *
   * Response:
   * {
   *   exchanges: Array<{
   *     name: string,
   *     deposits: number,
   *     withdrawals: number,
   *     depositsVolume: number,
   *     withdrawalsVolume: number
   *   }>,
   *   metadata: {
   *     period: string,
   *     metric: string
   *   }
   * }
   */
  .get("/", async (c) => {
    try {
      // Parse and validate query parameters
      const query = c.req.query();
      const params = exchangeRequestSchema.parse(query);

      const walletAddress = extractWalletAddress({
        address: params.address,
        wallets: params.wallets,
      });
      const limit = clampLimit(params.limit);
      const period = normalizePeriod({
        period: params.period,
        timePeriod: params.timePeriod,
      });

      // Wallet-aware path for wallet page chart usage.
      if (walletAddress) {
        const data = await getWalletExchangeCounts(walletAddress, {
          period,
          limit,
          metric: params.metric,
          chain: params.chain ?? "solana",
        });

        return c.json(data, 200);
      }

      // Generate exchange comparison data
      const data = generateExchangeData(params.timePeriod, params.metric);

      // Return response
      return c.json(data, 200);
    } catch (error) {
      console.error("Error fetching exchange comparison data:", error);
      return c.json(
        {
          error: "Failed to fetch exchange comparison data",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  });

export default app;
