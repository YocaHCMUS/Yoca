import { WALLET_PORTFOLIO_TTL_MS } from "@sv/config/constants.js";
import type { WalletPortfolioItem } from "./dtos/walletDataObjects.js";
import { enrichWalletPortfolioMetadata } from "./walletData.core.js";
import { db } from "@sv/db/index.js";
import { walletPortfolioCache } from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import { fetchBirdeyePortfolio } from "./fetchers/walletDataFetcher.service.js";

export async function getWalletPortfolio(
  address: string,
): Promise<WalletPortfolioItem[]> {
  // 0) DB-first: use cached portfolio if fresh
  const portfolioThreshold = new Date(Date.now() - WALLET_PORTFOLIO_TTL_MS);
  const cachedPortfolio = await db
    .select()
    .from(walletPortfolioCache)
    .where(and(eq(walletPortfolioCache.address, address)))
    .limit(1);
  if (
    cachedPortfolio.length > 0 &&
    cachedPortfolio[0].fetchedAt >= portfolioThreshold
  ) {
    const cachedData = (cachedPortfolio[0].data as WalletPortfolioItem[]) ?? [];
    if (cachedData.length > 0) {
      const enrichedCached = await enrichWalletPortfolioMetadata(cachedData, {
        address,
        source: "cache-hit",
      });

      if (enrichedCached.changed) {
        await db
          .insert(walletPortfolioCache)
          .values({ address, data: enrichedCached.portfolio })
          .onConflictDoUpdate({
            target: [walletPortfolioCache.address],
            set: { data: enrichedCached.portfolio, fetchedAt: new Date() },
          });
      }

      return enrichedCached.portfolio;
    }
    // If cached portfolio is empty (likely from an earlier failed API call),
    // fall through to external fetch instead of treating it as valid.
  }

  let selectedPortfolio: WalletPortfolioItem[] = [];
  let selectedSource: "birdeye" | "helius" | "none" = "none";
  try {
    const birdeyePortfolio = await fetchBirdeyePortfolio(address);
    if (
      birdeyePortfolio.items.length > 0 ||
      Number(birdeyePortfolio.totalAssetValueUsd ?? 0) > 0
    ) {
      selectedPortfolio = birdeyePortfolio.items;
      selectedSource = "birdeye";
    }
  } catch (err) {
    console.error("Failed to fetch Solana portfolio from Birdeye", err);
  }

  if (selectedPortfolio.length === 0) {
    return [];
  }

  const enrichedPortfolio = await enrichWalletPortfolioMetadata(
    selectedPortfolio,
    {
      address,
      source: selectedSource,
    },
  );

  await db
    .insert(walletPortfolioCache)
    .values({ address, data: enrichedPortfolio.portfolio })
    .onConflictDoUpdate({
      target: [walletPortfolioCache.address],
      set: { data: enrichedPortfolio.portfolio, fetchedAt: new Date() },
    });
  return enrichedPortfolio.portfolio;
}
