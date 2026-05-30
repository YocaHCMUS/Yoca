import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as bds from "@sv/util/util-birdeye.js";
import { bds_WalletNetAssetsSchema } from "../_types/wallet-raw-responses.js";

import { db } from "@sv/db/index.js";
import {
  walletTokenBalanceHistory,
  WalletTokenBalanceHistoryInsert,
} from "@sv/db/schema.js";
import {
  getStartOfUtcDatesFromNow,
  getStartOfUtcDatesFromNowMs,
} from "@sv/util/date.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import dayjs from "dayjs";
import { and, between, eq, inArray } from "drizzle-orm";

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
  const expectedDatesMs = getStartOfUtcDatesFromNowMs(timePeriod);
  const start = expectedDatesMs[expectedDatesMs.length - 1];
  const end = expectedDatesMs[0];

  // Get existing records from DB
  const existingRecords = await db
    .select()
    .from(walletTokenBalanceHistory)
    .where(
      and(
        between(walletTokenBalanceHistory.timestampMs, start, end),
        eq(walletTokenBalanceHistory.address, address),
        inArray(walletTokenBalanceHistory.tokenAddress, tokenAddresses),
      ),
    )
    .orderBy(
      walletTokenBalanceHistory.tokenAddress,
      walletTokenBalanceHistory.timestampMs,
    );

  // Build set of existing timestamps
  const existingTimestamps = new Set(existingRecords.map((r) => r.timestampMs));

  // Detect missing dates
  const missingTimestampsMs = expectedDatesMs.filter(
    (timestampMs) => !existingTimestamps.has(timestampMs),
  );

  // If there are gaps, fetch only those dates
  if (missingTimestampsMs.length > 0) {
    // Convert ms timestamps back to ISO strings for API calls
    const missingDates = missingTimestampsMs.map((ms) =>
      dayjs(ms).toISOString(),
    );

    const resArray = await Promise.all(
      missingDates.map((date) => bdsFetchAssetsAt(address, date)),
    );

    const insertValues = resArray.flatMap(
      (res) =>
        res?.net_assets.map(
          (tokenBalance): WalletTokenBalanceHistoryInsert => ({
            address: address,
            timestampMs: dayjs(res.date).valueOf(),
            tokenAddress: tokenBalance.token_address,
            tokenBalance: Number(tokenBalance.balance),
            usdValue: tokenBalance.value,
          }),
        ) || [],
    );

    // Write all tokens to db at once
    await db
      .insert(walletTokenBalanceHistory)
      .values(insertValues)
      .onConflictDoNothing();

    // Filter to requested token addresses if specified
    let newData: WalletTokenBalanceHistoryInsert[] = insertValues;
    if (tokenAddresses.length > 0) {
      newData = insertValues.filter((val) =>
        tokenAddresses.includes(val.tokenAddress),
      );
    }

    // Combine existing and new data
    const combinedRecords = [...existingRecords, ...(newData || [])];

    return groupTokenHistory(
      combinedRecords.map((row) => ({
        tokenAddress: row.tokenAddress,
        value: row.tokenBalance,
        usdValue: row.usdValue,
        timestampMs: row.timestampMs,
      })),
    );
  }

  // All dates found in DB
  if (existingRecords.length > 0) {
    return groupTokenHistory(
      existingRecords.map((row) => ({
        tokenAddress: row.tokenAddress,
        value: row.tokenBalance,
        usdValue: row.usdValue,
        timestampMs: row.timestampMs,
      })),
    );
  } else {
    // Fetch all dates if nothing in DB
    return fetchWalletTokenBalanceHistory(address, tokenAddresses, timePeriod);
  }
}

export async function fetchWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[] = [],
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  const dates = getStartOfUtcDatesFromNow(timePeriod);

  const resArray = await Promise.all(
    dates.map((date) => bdsFetchAssetsAt(address, date)),
  );

  const insertValues = resArray.flatMap(
    (res) =>
      res?.net_assets.map(
        (tokenBalance): WalletTokenBalanceHistoryInsert => ({
          address: address,
          timestampMs: dayjs(res.date).valueOf(),
          tokenAddress: tokenBalance.token_address,
          tokenBalance: Number(tokenBalance.balance),
          usdValue: tokenBalance.value,
        }),
      ) || [],
  );

  // Write all tokens to db at once
  await db
    .insert(walletTokenBalanceHistory)
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
  console.log("date: ", formattedTime);
  const url = bds.getEndpoint("/wallet/v2/net-worth-details");

  url.search = new URLSearchParams({
    wallet: walletAddress,
    type: "1d",
    sort_type: "desc",
    limit: "100",
    offset: "0",
    time: formattedTime,
  }).toString();

  const resp = await rlFetch(url, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
    rlLimiter: bds.limiter,
  });

  const res = await getTrackedApiResult(bds_WalletNetAssetsSchema, resp, true);

  if (!res || !res.data) {
    return null;
  }

  return { ...res.data, date: timeIsoUtc };
}
