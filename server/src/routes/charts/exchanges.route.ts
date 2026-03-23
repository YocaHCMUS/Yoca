/**
 * Exchange Comparison API Route
 *
 * Endpoint for fetching exchange comparison data
 *
 * @module routes/charts/exchanges.route
 */

import { getWalletExchangeCounts } from "@sv/services/wallet/walletExchangeAggregation.service.js";
import { Hono } from "hono";
import { z } from "zod";


/**
 * Request parameter schema for exchange comparison endpoint
 */
const exchangeRequestSchema = z.object({
  metric: z.enum(["count", "volume"]).optional().default("count"),
  timezone: z.string().optional().default("UTC"),
  wallet: z.string().optional(),
  limit: z
    .string()
    .optional()
    .default("2000")
    .transform((val) => Number.parseInt(val, 10)),
});

// function extractWalletAddress(params: { address?: string; wallet?: string }): string | null {
//   const directAddress = String(params.address ?? "").trim();
//   if (directAddress) {
//     return directAddress;
//   }

//   const walletsRaw = String(params.wallets ?? "").trim();
//   if (!walletsRaw) {
//     return null;
//   }

//   const firstWallet = walletsRaw
//     .split(",")
//     .map((entry) => entry.trim())
//     .find((entry) => entry.length > 0);

//   return firstWallet ?? null;
// }

function clampLimit(rawLimit: number): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed)) {
    return 2000;
  }

  const integerLimit = Math.floor(parsed);
  if (integerLimit < 1) {
    return 1;
  }

  if (integerLimit > 10000) {
    return 10000;
  }

  return integerLimit;
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
    * - metric: "count" or "volume" (default: "count")
    * - timezone: IANA timezone string (default: "UTC")
    * - wallet: wallet address for wallet-aware exchange comparison (optional)
    * - limit: maximum number of transactions to consider for wallet-aware comparison (default: 2000, max: 10000)
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


      const walletAddress = params.wallet ? String(params.wallet).trim() : null;

      const limit = clampLimit(params.limit);

      // Wallet-aware path for wallet page chart usage.
      if (walletAddress && walletAddress.length > 0) {
        const data = await getWalletExchangeCounts(walletAddress, {
          limit,
          metric: params.metric
        });

        return c.json(data, 200);
      }

      // Default path for general exchange comparison data.
      return c.json(
        {
          error: "Wallet address is required for exchange comparison data",
          message: "Please provide a valid 'wallet' query parameter to fetch exchange comparison data.",
        },
        400,
      );
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
