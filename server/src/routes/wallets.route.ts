import { Hono } from "hono";
import {
  getWalletOverview,
  getWalletPortfolio,
  getWalletTransactions,
  getWalletExchangeCounts,
  type SupportedChain,
} from "@sv/services/walletData.service.js";

const router = new Hono();

function getChainFromQuery(c: any): SupportedChain {
  const chain = c.req.query("chain");
  // Default to solana for now if not specified
  return (chain as SupportedChain) || "solana";
}

router.get("/:address/overview", async (c) => {
  const address = c.req.param("address");
  const chain = getChainFromQuery(c);

  try {
    const overview = await getWalletOverview(address, chain);
    return c.json(overview);
  } catch (err) {
    console.error("Failed to get wallet overview", err);
    return c.json({ error: "Failed to get wallet overview" }, 500);
  }
});

router.get("/:address/portfolio", async (c) => {
  const address = c.req.param("address");
  const chain = getChainFromQuery(c);

  try {
    const portfolio = await getWalletPortfolio(address, chain);
    return c.json({ address, chain, portfolio });
  } catch (err) {
    console.error("Failed to get wallet portfolio", err);
    return c.json({ error: "Failed to get wallet portfolio" }, 500);
  }
});

router.get("/:address/transactions", async (c) => {
  const address = c.req.param("address");
  const chain = getChainFromQuery(c);

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
    return c.json(txs);
  } catch (err) {
    console.error("Failed to get wallet transactions", err);
    return c.json({ error: "Failed to get wallet transactions" }, 500);
  }
});

router.get("/:address/exchanges", async (c) => {
  const address = c.req.param("address");
  const chain = getChainFromQuery(c);
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

export default router;

