import { and, gte, inArray } from "drizzle-orm";
import { db } from "@sv/db/index.js";
import { walletTransactions } from "@sv/db/schema.js";

type TimePeriod = "7D" | "30D" | "60D" | "90D" | "1Y" | "All";

interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

interface TransactionDistributionResponse {
  transactionCounts: {
    walletId: string;
    walletName: string;
    data: TimeSeriesPoint[];
  }[];
  uniqueTokenCounts: TimeSeriesPoint[];
  metadata: {
    period: string;
    transactionType: string;
  };
}

/**
 * Convert a time period label into a number of days.
 */
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
 * Floor a Date to the start of the day in UTC.
 */
function startOfDayUtc(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Build transaction distribution (counts by wallet and unique tokens traded)
 * from cached wallet_transactions data in the database.
 *
 * - If walletIds is provided, data is restricted to those addresses.
 * - If walletIds is empty, it uses all addresses present in the time window.
 */
export async function getTransactionDistributionFromDb(
  timePeriod: TimePeriod,
  transactionType: string,
  walletIds: string[],
): Promise<TransactionDistributionResponse> {
  const days = getDaysForPeriod(timePeriod);
  const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // 1) Load all cached transactions within the time range (optionally restricted to walletIds)
  const whereClauses = [gte(walletTransactions.blockTimestamp, fromDate)];

  if (walletIds.length > 0) {
    whereClauses.push(inArray(walletTransactions.address, walletIds));
  }

  const rows = await db
    .select()
    .from(walletTransactions)
    .where(and(...whereClauses));

  if (rows.length === 0) {
    return {
      transactionCounts: [],
      uniqueTokenCounts: [],
      metadata: {
        period: timePeriod,
        transactionType,
      },
    };
  }

  // 2) Optional filter by transactionType using cached direction/mainAction fields
  function matchesType(row: (typeof walletTransactions)["$inferSelect"]): boolean {
    const dir = row.direction;
    const action = row.mainAction ?? "";

    switch (transactionType) {
      case "deposits":
        return dir === "in";
      case "withdrawals":
        return dir === "out";
      case "trades":
        return action.toLowerCase().includes("swap") || action.toLowerCase().includes("trade");
      case "transfers":
        return action.toLowerCase().includes("transfer") || !action;
      case "all":
      default:
        return true;
    }
  }

  const filteredRows = rows.filter(matchesType);

  if (filteredRows.length === 0) {
    return {
      transactionCounts: [],
      uniqueTokenCounts: [],
      metadata: {
        period: timePeriod,
        transactionType,
      },
    };
  }

  // 3) Group counts by wallet address and day, and collect unique tokens per day
  const perWalletPerDay = new Map<
    string,
    Map<number, number>
  >();
  const perDayTokenSet = new Map<number, Set<string>>();

  for (const row of filteredRows) {
    const wallet = row.address;
    const dayKey = startOfDayUtc(row.blockTimestamp);

    // per-wallet counts
    let walletMap = perWalletPerDay.get(wallet);
    if (!walletMap) {
      walletMap = new Map();
      perWalletPerDay.set(wallet, walletMap);
    }
    walletMap.set(dayKey, (walletMap.get(dayKey) ?? 0) + 1);

    // unique tokens per day (across all wallets)
    const tokens = (row.tokens as string[] | null) ?? [];
    if (!perDayTokenSet.has(dayKey)) {
      perDayTokenSet.set(dayKey, new Set());
    }
    const tokenSet = perDayTokenSet.get(dayKey)!;
    for (const token of tokens) {
      if (token) {
        tokenSet.add(token);
      }
    }
  }

  // 4) Build transactionCounts series for each wallet we actually have data for
  const transactionCounts: TransactionDistributionResponse["transactionCounts"] = [];

  for (const [walletAddress, dayMap] of perWalletPerDay.entries()) {
    const data = Array.from(dayMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, value]) => ({ timestamp, value }));

    const short = `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`;

    transactionCounts.push({
      walletId: walletAddress,
      walletName: short,
      data,
    });
  }

  // 5) Build uniqueTokenCounts series
  const uniqueTokenCounts = Array.from(perDayTokenSet.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, tokens]) => ({
      timestamp,
      value: tokens.size,
    }));

  return {
    transactionCounts,
    uniqueTokenCounts,
    metadata: {
      period: timePeriod,
      transactionType,
    },
  };
}

