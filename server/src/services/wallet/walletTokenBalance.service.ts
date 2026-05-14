import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import type {
  TokenBalanceSeriesResult,
  WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as bds from "@sv/util/util-birdeye.js";
import { bds_WalletNetAssetsSchema } from "../_types/wallet-raw-responses.js";

import { db } from "@sv/db/index.js";
import { walletTokenBalanceHistory } from "@sv/db/schema.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { and, eq, gte, lte } from "drizzle-orm";

dayjs.extend(utc);

function getUtcDatesFromNow(days: number): string[] {
  const nowUtc = dayjs.utc();
  const todayStart = nowUtc.startOf("day");
  const results: string[] = [];

  for (let i = 0; i < days; i++) {
    const date = todayStart.subtract(i, "day");
    results.push(date.toISOString());
  }
  return results;
}

// export type WalletTimePeriod = "24H" | "7D" | "30D" | "60D" | "90D" | "1Y" | "All";
const toDayCount: Record<WalletTimePeriod, number> = {
  "24H": 1,
  "7D": 7,
  "30D": 30,
  "60D": 60,
  "90D": 90,
  "1Y": 365,
  All: -1,
};

export async function getWalletTokenBalanceHistory(
  address: string,
  tokenAddress: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<TokenBalanceSeriesResult> {
  const dates = getUtcDatesFromNow(toDayCount[timePeriod]);

  const start = dayjs(dates[dates.length - 1]).valueOf();
  const end = dayjs(dates[0]).valueOf();

  const res = await db
    .select()
    .from(walletTokenBalanceHistory)
    .where(
      and(
        eq(walletTokenBalanceHistory.address, address),
        eq(walletTokenBalanceHistory.tokenAddress, tokenAddress),
        gte(walletTokenBalanceHistory.timestampMs, start),
        lte(walletTokenBalanceHistory.timestampMs, end),
      ),
    )
    .limit(1);

  if (res.length > 0) {
    return {
      tokenSeries: res.map((row) => ({
        value: row.tokenBalance,
        timestamp: row.timestampMs,
        date: new Date(row.timestampMs).toISOString(),
      })),
      usdSeries: res.map((row) => ({
        value: row.usdValue,
        timestamp: row.timestampMs,
        date: new Date(row.timestampMs).toISOString(),
      })),
      tokenSymbol: res[0].tokenSymbol ?? "",
      tokenAddress,
    };
  } else {
    return fetchWalletTokenBalanceHistory(address, tokenAddress, timePeriod);
  }
}

export async function fetchWalletTokenBalanceHistory(
  address: string,
  tokenAddress: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<TokenBalanceSeriesResult> {
  const dates = getUtcDatesFromNow(toDayCount[timePeriod]);
  // TODO: rate limit here
  const res = Promise.all(dates.map((date) => bdsFetchAssetsAt(address, date)));
}

async function bdsFetchAssetsAt(
  walletAddress: string,
  tokenAddress: string,
  timeIsoUtc: string,
) {
  const url = bds.getEndpoint("/wallet/v2/net-worth-details");

  url.search = new URLSearchParams({
    wallet: walletAddress,
    type: "1d",
    sort_type: "desc",
    limit: "100",
    offset: "0",
    time: timeIsoUtc,
  }).toString();

  const resp = await fetch(url, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  if (!resp.ok) {
    return null;
  }

  const res = await getTrackedApiResult(bds_WalletNetAssetsSchema, resp);

  if (!res || !res.data) {
    return null;
  }

  return res.data;
}
