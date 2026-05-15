import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as bds from "@sv/util/util-birdeye.js";
import { bds_WalletNetAssetsSchema } from "../_types/wallet-raw-responses.js";

import { db } from "@sv/db/index.js";
import {
  walletTokenBalanceHistory,
  WalletTokenBalanceHistoryInsert,
} from "@sv/db/schema.js";
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

type WalletTokenBalanceHistory = {
  tokenAddress: string;
  value: number;
  usdValue: number;
  timestamp: number;
}[];

const dayCount: Record<WalletTimePeriod, number> = {
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
): Promise<WalletTokenBalanceHistory> {
  const dates = getUtcDatesFromNow(dayCount[timePeriod]);

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
    return res.map((row) => ({
      tokenAddress: row.tokenAddress,
      value: row.tokenBalance,
      usdValue: row.usdValue,
      timestamp: row.timestampMs,
    }));
  } else {
    return fetchWalletTokenBalanceHistory(address, tokenAddress, timePeriod);
  }
}

export async function fetchWalletTokenBalanceHistory(
  address: string,
  tokenAddress: string,
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  const dates = getUtcDatesFromNow(dayCount[timePeriod]);
  // TODO: rate limit here
  const resArray = await Promise.all(
    dates.map((date) => bdsFetchAssetsAt(address, date)),
  );

  const insertValues = resArray.flatMap(
    (res) =>
      res?.net_assets.map(
        (tokBal): WalletTokenBalanceHistoryInsert => ({
          address: address,
          timestampMs: dayjs(res.resolved_timestamp).valueOf(),
          tokenAddress: tokBal.token_address,
          tokenBalance: Number(tokBal.balance),
          usdValue: tokBal.value,
        }),
      ) || [],
  );

  // Write all tokens to db at once
  db.insert(walletTokenBalanceHistory)
    .values(insertValues)
    .onConflictDoNothing();

  return insertValues.find((val) => val.tokenAddress == tokenAddress) || null;
}

async function bdsFetchAssetsAt(walletAddress: string, timeIsoUtc: string) {
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
