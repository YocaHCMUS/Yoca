import { WALLET_PORTFOLIO_TTL_MS } from "@sv/config/constants.js";
import type { WalletPortfolioItem } from "./dtos/walletDataObjects.js";
import { enrichWalletPortfolioMetadata } from "./walletData.core.js";
import { db } from "@sv/db/index.js";
import { walletPortfolioCache } from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { fetchHeliusSolanaPortfolio } from "./fetchers/walletDataFetcher.service.js";

const walletPortfolioCacheSchema = z.array(
  z.object({
    tokenAddress: z.string(),
    symbol: z.string(),
    name: z.string().optional(),
    logoUri: z.string().optional(),
    amount: z.number(),
    priceUsd: z.number().optional(),
    valueUsd: z.number(),
    change24hPercent: z.number().optional(),
  }),
);

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
  const cachedDataResult = walletPortfolioCacheSchema.safeParse(
    cachedPortfolio[0]?.data,
  );
  const cachedData: WalletPortfolioItem[] = cachedDataResult.success
    ? cachedDataResult.data
    : [];
  if (
    cachedPortfolio.length > 0 &&
    cachedDataResult.success &&
    cachedPortfolio[0].fetchedAt >= portfolioThreshold
  ) {
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

  let selectedPortfolio: WalletPortfolioItem[] = [];
  try {
    selectedPortfolio = await fetchHeliusSolanaPortfolio(address);
  } catch (err) {
    console.error("Failed to fetch Solana portfolio from Helius", err);
  }

  if (selectedPortfolio.length === 0) {
    if (cachedData.length > 0) {
      const enrichedStale = await enrichWalletPortfolioMetadata(cachedData, {
        address,
        source: "stale-cache",
      });
      return enrichedStale.portfolio;
    }

    return [];
  }

  const enrichedPortfolio = await enrichWalletPortfolioMetadata(
    selectedPortfolio,
    {
      address,
      source: "helius",
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
