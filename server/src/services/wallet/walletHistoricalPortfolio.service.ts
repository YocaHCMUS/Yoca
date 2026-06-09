import type { WalletPortfolioItem } from "./dtos/walletDataObjects.js";
import type { BirdeyePortfolioSnapshotAsset } from "./dtos/walletDataObjects.js";
import { enrichWalletPortfolioMetadata } from "./walletData.core.js";
import { db } from "@sv/db/index.js";
import { walletHistoricalPortfolioCache } from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import { fetchBirdeyePortfolioSnapshot } from "./fetchers/walletDataFetcher.service.js";

function birdeyeTimeFromDate(date: string): string {
  return `${date} 23:59:59`;
}

function mapSnapshotAssetsToPortfolioItems(
  assets: BirdeyePortfolioSnapshotAsset[],
): WalletPortfolioItem[] {
  return assets.map((asset) => {
    const decimals = Math.max(0, asset.decimals);
    const divisor = 10 ** decimals;
    const amount = divisor > 0 ? Number(asset.balanceRaw) / divisor : 0;

    return {
      tokenAddress: asset.tokenAddress,
      symbol: asset.symbol,
      amount,
      priceUsd: asset.priceUsd ?? undefined,
      valueUsd: asset.valueUsd,
    };
  });
}

export async function getHistoricalPortfolio(
  address: string,
  date: string,
): Promise<WalletPortfolioItem[]> {
  const cached = await db
    .select()
    .from(walletHistoricalPortfolioCache)
    .where(
      and(
        eq(walletHistoricalPortfolioCache.address, address),
        eq(walletHistoricalPortfolioCache.date, date),
      ),
    )
    .limit(1);

  if (cached.length > 0) {
    const cachedData = (cached[0].data as WalletPortfolioItem[]) ?? [];
    if (cachedData.length > 0) {
      return cachedData;
    }
  }

  const time = birdeyeTimeFromDate(date);
  const snapshot = await fetchBirdeyePortfolioSnapshot(address, { time });

  if (!snapshot || snapshot.assets.length === 0) {
    return [];
  }

  const mapped = mapSnapshotAssetsToPortfolioItems(snapshot.assets);

  const enriched = await enrichWalletPortfolioMetadata(mapped, {
    address,
    source: "birdeye-historical",
  });

  await db
    .insert(walletHistoricalPortfolioCache)
    .values({
      address,
      date,
      data: enriched.portfolio,
    })
    .onConflictDoNothing();

  return enriched.portfolio;
}
