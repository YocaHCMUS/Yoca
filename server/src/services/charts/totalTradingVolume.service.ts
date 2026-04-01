import { and, gte, inArray } from "drizzle-orm";
import { db } from "@sv/db/index.js";
import {
  walletHeliusTransactions,
  tokenMarketData,
} from "@sv/db/schema.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";

interface WalletVolume {
  walletAddress: string;
  walletName: string;
  totalVolume: number;
  depositVolume: number;
  withdrawalVolume: number;
  tradeCount: number;
  rank: number;
}

export interface TotalTradingVolumeResponse {
  wallets: WalletVolume[];
  metadata: {
    period: string;
    timestamp: number;
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

/**
 * Get total trading volume per wallet from DB cache.
 *
 * Solana: wallet_helius_transactions (balanceChanges priced via token_market_data).
 */
export async function getTotalTradingVolumeFromDb(
  walletAddresses: string[],
  period: TimePeriod,
): Promise<TotalTradingVolumeResponse> {
  const days = getDaysForPeriod(period);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Per-wallet accumulators
  const acc = new Map<
    string,
    { total: number; deposit: number; withdrawal: number; count: number }
  >();

  const getAcc = (addr: string) => {
    let entry = acc.get(addr);
    if (!entry) {
      entry = { total: 0, deposit: 0, withdrawal: 0, count: 0 };
      acc.set(addr, entry);
    }
    return entry;
  };

  // --- 1) Solana: wallet_helius_transactions ---
  {
    const where = [gte(walletHeliusTransactions.timestamp, fromDate)];
    if (walletAddresses.length > 0) {
      where.push(inArray(walletHeliusTransactions.address, walletAddresses));
    }

    const rows = await db
      .select()
      .from(walletHeliusTransactions)
      .where(and(...where));

    if (rows.length > 0) {
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
          if (Number.isFinite(p) && p > 0) priceMap.set(pr.address, p);
        }
      }

      for (const row of rows) {
        const changes = row.balanceChanges as Array<{
          mint: string;
          amount: number;
          decimals: number;
        }> | null;
        if (!changes || changes.length === 0) continue;

        let depositUsd = 0;
        let withdrawalUsd = 0;

        for (const c of changes) {
          const price = priceMap.get(c.mint);
          if (price == null) continue;
          const valueUsd = Math.abs(c.amount) * price;
          if (c.amount > 0) {
            depositUsd += valueUsd;
          } else if (c.amount < 0) {
            withdrawalUsd += valueUsd;
          }
        }

        // Single-side volume: use the larger leg to avoid double-counting
        const singleSideVolume = Math.max(depositUsd, withdrawalUsd);
        if (singleSideVolume <= 0) continue;

        const entry = getAcc(row.address);
        entry.total += singleSideVolume;
        entry.deposit += depositUsd;
        entry.withdrawal += withdrawalUsd;
        entry.count += 1;
      }
    }
  }

  // Build ranked result
  const wallets: WalletVolume[] = Array.from(acc.entries())
    .map(([addr, v]) => {
      const short = `${addr.slice(0, 4)}...${addr.slice(-4)}`;
      return {
        walletAddress: addr,
        walletName: short,
        totalVolume: Math.round(v.total * 100) / 100,
        depositVolume: Math.round(v.deposit * 100) / 100,
        withdrawalVolume: Math.round(v.withdrawal * 100) / 100,
        tradeCount: v.count,
        rank: 0,
      };
    })
    .sort((a, b) => b.totalVolume - a.totalVolume);

  wallets.forEach((w, i) => {
    w.rank = i + 1;
  });

  return {
    wallets,
    metadata: {
      period,
      timestamp: Date.now(),
      currency: "USD",
    },
  };
}
