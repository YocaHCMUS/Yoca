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
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { getUtcDatesFromNow } from "@sv/util/date.js";

type WalletTokenBalanceHistory =
  | {
      tokenAddress: string;
      value: number;
      usdValue: number;
      timestampMs: number;
    }[]
  | null;

export async function getWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[] = [],
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  const dates = getUtcDatesFromNow(timePeriod);

  const start = dayjs(dates[dates.length - 1]).valueOf();
  const end = dayjs(dates[0]).valueOf();

  const res = await db
    .select()
    .from(walletTokenBalanceHistory)
    .where(
      and(
        gte(walletTokenBalanceHistory.timestampMs, start),
        lte(walletTokenBalanceHistory.timestampMs, end),
        eq(walletTokenBalanceHistory.address, address),
        inArray(walletTokenBalanceHistory.tokenAddress, tokenAddresses),
      ),
    );

  if (res.length > 0) {
    return res.map((row) => ({
      tokenAddress: row.tokenAddress,
      value: row.tokenBalance,
      usdValue: row.usdValue,
      timestampMs: row.timestampMs,
    }));
  } else {
    return fetchWalletTokenBalanceHistory(address, tokenAddresses, timePeriod);
  }
}

export async function fetchWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[] = [],
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  const dates = getUtcDatesFromNow(timePeriod);
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

  const targetAddressBalanceHistory =
    tokenAddresses.length > 0
      ? insertValues.filter((val) => tokenAddresses.includes(val.tokenAddress))
      : insertValues;

  if (targetAddressBalanceHistory.length === 0) {
    return null;
  }

  return targetAddressBalanceHistory.map((point) => ({
    tokenAddress: point.tokenAddress,
    value: point.tokenBalance,
    usdValue: point.usdValue,
    timestampMs: point.timestampMs,
  }));
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
