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

type WalletTokenBalanceHistory = Record<
  string,
  {
    value: number;
    usdValue: number;
    timestampMs: number;
  }[]
> | null;

function groupTokenHistory(
  rows: {
    tokenAddress: string;
    value: number;
    usdValue: number;
    timestampMs: number;
  }[],
): WalletTokenBalanceHistory {
  const grouped: NonNullable<WalletTokenBalanceHistory> = {};

  for (const row of rows) {
    if (!grouped[row.tokenAddress]) {
      grouped[row.tokenAddress] = [];
    }

    grouped[row.tokenAddress].push({
      value: row.value,
      usdValue: row.usdValue,
      timestampMs: row.timestampMs,
    });
  }

  return Object.keys(grouped).length > 0 ? grouped : null;
}

export async function getWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[],
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
    return groupTokenHistory(
      res.map((row) => ({
        tokenAddress: row.tokenAddress,
        value: row.tokenBalance,
        usdValue: row.usdValue,
        timestampMs: row.timestampMs,
      })),
    );
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

  if (targetAddressBalanceHistory.length == 0) {
    return null;
  }

  return groupTokenHistory(
    targetAddressBalanceHistory.map((point) => ({
      tokenAddress: point.tokenAddress,
      value: point.tokenBalance,
      usdValue: point.usdValue,
      timestampMs: point.timestampMs,
    })),
  );
}

async function bdsFetchAssetsAt(walletAddress: string, timeIsoUtc: string) {
  const formattedTime = dayjs.utc(timeIsoUtc).format("YYYY-MM-DD HH:mm:ss");
  const url = bds.getEndpoint("/wallet/v2/net-worth-details");

  url.search = new URLSearchParams({
    wallet: walletAddress,
    type: "1d",
    sort_type: "desc",
    limit: "100",
    offset: "0",
    time: formattedTime,
  }).toString();

  const resp = await fetch(url, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  if (!resp.ok) {
    console.log(resp.status, resp.statusText, await resp.json());
    return null;
  }
  // console.log("res json: ", resp.json());
  const res = await getTrackedApiResult(bds_WalletNetAssetsSchema, resp);
  if (!res || !res.data) {
    return null;
  }

  return res.data;
}
