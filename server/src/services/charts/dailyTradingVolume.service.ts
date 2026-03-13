import { and, gte, inArray } from "drizzle-orm";
import { db } from "@sv/db/index.js";
import {
  walletHeliusTransactions,
  tokenMarketData,
} from "@sv/db/schema.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";

export interface DailyTradingVolumeWalletSeries {
  walletAddress: string;
  walletName: string;
  volumes: number[];
}

export interface DailyTradingVolumeResponse {
  dates: string[];
  wallets: DailyTradingVolumeWalletSeries[];
  metadata: {
    period: string;
    currency: string;
  };
}

function getDaysForPeriod(period: TimePeriod): number {
  switch (period) {
    case "7D":
      return 7;
    case "30D":
      return 30;
    case "60D":
      return 60;
    case "90D":
      return 90;
    case "1Y":
      return 365;
    case "All":
      return 730;
    default:
      return 30;
  }
}

function startOfDayUtc(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function formatDayLabel(timestampMs: number): string {
  const d = new Date(timestampMs);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EMPTY_RESPONSE = (period: string): DailyTradingVolumeResponse => ({
  dates: [],
  wallets: [],
  metadata: { period, currency: "USD" },
});

function buildResult(
  perWalletPerDay: Map<string, Map<number, number>>,
  allDays: Set<number>,
  period: string,
): DailyTradingVolumeResponse {
  if (perWalletPerDay.size === 0 || allDays.size === 0) {
    return EMPTY_RESPONSE(period);
  }

  const sortedDays = Array.from(allDays.values()).sort((a, b) => a - b);
  const dates = sortedDays.map((ts) => formatDayLabel(ts));

  const wallets: DailyTradingVolumeWalletSeries[] = [];
  for (const [walletAddress, dayMap] of perWalletPerDay.entries()) {
    const volumes = sortedDays.map((day) =>
      Math.round((dayMap.get(day) ?? 0) * 100) / 100,
    );
    const short = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;
    wallets.push({ walletAddress, walletName: short, volumes });
  }

  return { dates, wallets, metadata: { period, currency: "USD" } };
}

/**
 * Build daily trading volume (USD) per wallet.
 *
 * For Solana wallets: reads `wallet_helius_transactions` (balanceChanges)
 * and prices each mint via `token_market_data`.
 *
 * For EVM wallets: reads `wallet_transactions` (totalUsd / primaryTokenAmount * priceUsd).
 *
 * Only reads from DB cache; does not call Helius or any external API.
 */
export async function getDailyTradingVolumeFromDb(
  timePeriod: TimePeriod,
  walletAddresses: string[],
): Promise<DailyTradingVolumeResponse> {
  const days = getDaysForPeriod(timePeriod);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const perWalletPerDay = new Map<string, Map<number, number>>();
  const allDays = new Set<number>();

  // --- 1) Solana: wallet_helius_transactions ---
  {
    const whereClauses = [
      gte(walletHeliusTransactions.timestamp, fromDate),
    ];
    if (walletAddresses.length > 0) {
      whereClauses.push(
        inArray(walletHeliusTransactions.address, walletAddresses),
      );
    }

    const rows = await db
      .select()
      .from(walletHeliusTransactions)
      .where(and(...whereClauses));

    if (rows.length > 0) {
      // Collect all unique mints to fetch prices in one query
      const mintSet = new Set<string>();
      for (const row of rows) {
        const changes = row.balanceChanges as Array<{
          mint: string;
          amount: number;
          decimals: number;
        }> | null;
        if (!changes) continue;
        for (const c of changes) {
          if (c.mint) mintSet.add(c.mint);
        }
      }

      // Batch-fetch current prices for all mints
      const priceMap = new Map<string, number>();
      if (mintSet.size > 0) {
        const priceRows = await db
          .select({
            address: tokenMarketData.address,
            priceUsd: tokenMarketData.priceUsd,
          })
          .from(tokenMarketData)
          .where(inArray(tokenMarketData.address, Array.from(mintSet)));

        for (const pr of priceRows) {
          const p = Number(pr.priceUsd);
          if (Number.isFinite(p) && p > 0) {
            priceMap.set(pr.address, p);
          }
        }
      }

      for (const row of rows) {
        const wallet = row.address;
        const ts = row.timestamp;
        if (!ts) continue;

        const dayKey = startOfDayUtc(ts);

        const changes = row.balanceChanges as Array<{
          mint: string;
          amount: number;
          decimals: number;
        }> | null;
        if (!changes || changes.length === 0) continue;

        let txVolumeUsd = 0;
        for (const c of changes) {
          const price = priceMap.get(c.mint);
          if (price == null) continue;
          // balanceChanges amounts are already decimal-adjusted in our DB
          txVolumeUsd += Math.abs(c.amount) * price;
        }

        if (txVolumeUsd <= 0) continue;

        // Only count one side of the swap to avoid double-counting.
        // Each swap has both a positive and negative leg; halving gives
        // a single-side volume figure.
        txVolumeUsd = txVolumeUsd / 2;

        let walletMap = perWalletPerDay.get(wallet);
        if (!walletMap) {
          walletMap = new Map();
          perWalletPerDay.set(wallet, walletMap);
        }
        walletMap.set(dayKey, (walletMap.get(dayKey) ?? 0) + txVolumeUsd);
        allDays.add(dayKey);
      }
    }
  }

  return buildResult(perWalletPerDay, allDays, timePeriod);
}
