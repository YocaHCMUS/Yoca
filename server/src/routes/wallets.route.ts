import { Hono } from "hono";
import {
  fetchTestTransaction,
  getWalletOverview,
  getWalletPortfolio,
  getWalletTransactions,
  getWalletExchangeCounts,
  getWalletSwaps,
  getWalletTransfers
} from "@sv/services/wallet/walletData.service.js";

const router = new Hono();
import { z } from "zod";
import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";

// function getChainFromQuery(c: any): SupportedChain {
//   const chain = c.req.query("chain");
//   // Default to solana for now if not specified
//   return (chain as SupportedChain) || "solana";
// }

const walletRequestSchema = z.object({
  address: z.string(),
  chain: z.string().optional(),
});

const walletOverviewRequestSchema = walletRequestSchema.extend({
  period: z.string().optional(),
});

const DEFAULT_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const MIN_OVERVIEW_PERIOD_SEC = 24 * 60 * 60;
const MAX_OVERVIEW_PERIOD_SEC = 7 * 24 * 60 * 60;

function parseOverviewPeriodSec(rawPeriod?: string): {
  periodSec: number;
  normalized: boolean;
} {
  if (!rawPeriod) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: false };
  }

  const trimmed = rawPeriod.trim().toLowerCase();
  if (!trimmed) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: false };
  }

  const explicitUnitMatch = trimmed.match(/^(\d+)\s*([hd])$/);
  const dayOnlyMatch = trimmed.match(/^(\d+)$/);

  let periodSec: number | null = null;
  if (explicitUnitMatch) {
    const amount = Number(explicitUnitMatch[1]);
    const unit = explicitUnitMatch[2];
    periodSec = unit === "h" ? amount * 60 * 60 : amount * 24 * 60 * 60;
  } else if (dayOnlyMatch) {
    periodSec = Number(dayOnlyMatch[1]) * 24 * 60 * 60;
  }

  if (
    periodSec == null ||
    !Number.isFinite(periodSec) ||
    periodSec < MIN_OVERVIEW_PERIOD_SEC ||
    periodSec > MAX_OVERVIEW_PERIOD_SEC
  ) {
    return { periodSec: DEFAULT_OVERVIEW_PERIOD_SEC, normalized: true };
  }

  return { periodSec, normalized: false };
}

router.get("/overview", async (c) => {
  //  .get("/", async (c) => {
  //     try {
  //       // Validate query parameters
  //       const query = c.req.query();
  //       console.log('[balance.route] Raw query:', query);

  //       const params = balanceRequestSchema.parse(query);
  //       console.log('[balance.route] Parsed params:', params);

  //       // Generate balance trend data
  //       const data = generateBalanceTrend(
  //         params.timePeriod,
  //         params.tokens,
  //         params.wallets,
  //       );
  const query = c.req.query();
  const params = walletOverviewRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana";
  const { periodSec, normalized } = parseOverviewPeriodSec(params.period);

  if (normalized && params.period) {
    console.warn("[wallet-overview-route] Unsupported period normalized to 24h", {
      address,
      chain,
      requestedPeriod: params.period,
    });
  }

  try {
    const overview = await getWalletOverview(address, chain, { periodSec });
    return c.json(overview);
  } catch (err) {
    console.error("Failed to get wallet overview", err);
    return c.json({ error: "Failed to get wallet overview" }, 500);
  }
});

router.get("/portfolio", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"

  try {
    const portfolio = await getWalletPortfolio(address, chain);
    return c.json(portfolio);
  } catch (err) {
    console.error("Failed to get wallet portfolio", err);
    return c.json({ error: "Failed to get wallet portfolio" }, 500);
  }
});

router.get("/transactions", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"

  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const before = c.req.query("before");

  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const txs = await getWalletTransactions(address, chain, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor ?? undefined,
      before: before ?? undefined,
    });
    // console.log("[transaction route] data:")
    // console.log(txs);
    return c.json(txs);
  } catch (err) {
    console.error("Failed to get wallet transactions", err);
    return c.json({ error: "Failed to get wallet transactions" }, 500);
  }
});

router.get("/swap", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"

  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const before = c.req.query("before");

  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const txs = await getWalletSwaps(address, chain, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor ?? undefined,
      before: before ?? undefined,
    });

    return c.json(txs);
  } catch (err) {
    console.error("Failed to get wallet swaps", err);
    return c.json({ error: "Failed to get wallet swaps" }, 500);
  }
});

router.get("/transfers", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"

  const limitParam = c.req.query("limit");
  const cursor = c.req.query("cursor");
  const before = c.req.query("before");

  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const txs = await getWalletTransfers(address, chain, {
      limit: Number.isFinite(limit) ? limit : undefined,
      cursor: cursor ?? undefined,
      before: before ?? undefined,
    });

    return c.json(txs);
  } catch (err) {
    console.error("Failed to get wallet transfers", err);
    return c.json({ error: "Failed to get wallet transfers" }, 500);
  }
})

router.get("/distribution", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"

  try {
    // Get portfolio data which forms the asset distribution
    const portfolio = await getWalletPortfolio(address, chain);

    // Transform portfolio data into distribution format
    // Calculate percentages based on total value
    const totalValue = portfolio.reduce((sum: number, item: any) => sum + (item.valueUsd ?? 0), 0);

    const distributionData = portfolio.map((item: any) => ({
      name: item.symbol || item.token || 'Unknown',
      value: item.valueUsd ?? 0,
      percentage: totalValue > 0 ? ((item.valueUsd ?? 0) / totalValue) * 100 : 0,
      rawAmount: item.amount ?? item.holding ?? 0,
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
    console.error("Failed to get wallet asset distribution", err);
    return c.json({ error: "Failed to get wallet asset distribution" }, 500);
  }
});

router.get("/exchanges", async (c) => {
  const query = c.req.query();
  const params = walletRequestSchema.parse(query)
  const address = params.address;
  const chain = (params.chain as SupportedChain) || "solana"
  const limitParam = c.req.query("limit");
  const limit = limitParam && Number.isFinite(Number(limitParam)) ? Number(limitParam) : undefined;

  try {
    const data = await getWalletExchangeCounts(address, chain, { limit });
    return c.json(data);
  } catch (err) {
    console.error("Failed to get wallet exchange counts", err);
    return c.json({ error: "Failed to get wallet exchange counts" }, 500);
  }
});

router.get("/debug/test-transactions", async (c) => {
  const address = c.req.query("address");

  if (!address) {
    return c.json({ error: "Missing required query param: address" }, 400);
  }

  try {
    const data = await fetchTestTransaction(address);
    return c.json({ address, data });
  } catch (err) {
    console.error("Failed to fetch test transactions", err);
    return c.json({ error: "Failed to fetch test transactions" }, 500);
  }
});

router.get("/debug/identity", async (c) => {
  const address = c.req.query("address");

  if (!address) {
    return c.json({ error: "Missing required query param: address" }, 400);
  }

  try {
    const { getWalletIdentity } = await import("@sv/services/wallet/walletIdentity.service.js");
    const data = await getWalletIdentity(address);
    return c.json({ address, data });
  } catch (err) {
    console.error("Failed to fetch wallet identity", err);
    return c.json({ error: "Failed to fetch wallet identity" }, 500);
  }
});

export default router;

