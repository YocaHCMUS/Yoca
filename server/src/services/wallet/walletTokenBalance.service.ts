import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import * as bds from "@sv/util/util-birdeye.js";
import {
  BDS_WalletNetAssets,
  bds_WalletNetAssetsSchema,
} from "../_types/wallet-raw-responses.js";

import { db } from "@sv/db/index.js";
import {
  walletTokenBalanceHistory,
  WalletTokenBalanceHistoryInsert,
} from "@sv/db/schema.js";
import { getDateMsFromNow } from "@sv/util/date.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import dayjs from "dayjs";
import { and, between, eq, inArray } from "drizzle-orm";
import { WALLET_BALANCE_HISTORY_CACHE_TTL_MS } from "@sv/config/constants.js";

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
  // Group by address first
  const addressMap = new Map<string, Record<string, (typeof rows)[0]>>();
  for (const row of rows) {
    if (!addressMap.has(row.tokenAddress)) {
      addressMap.set(row.tokenAddress, {});
    }
    const tokenDays = addressMap.get(row.tokenAddress)!;
    // Create a date key (e.g., "2026-06-01")
    const dateKey = dayjs.utc(row.timestampMs).format("YYYY-MM-DD");
    // Only keep the latest timestamp for that specific day
    if (
      !tokenDays[dateKey] ||
      row.timestampMs > tokenDays[dateKey].timestampMs
    ) {
      tokenDays[dateKey] = row;
    }
  }
  // Convert the collapsed day-map back into the expected array format
  addressMap.forEach((tokenDays, tokenAddress) => {
    grouped[tokenAddress] = Object.values(tokenDays)
      .map((row) => ({
        value: row.value,
        usdValue: row.usdValue,
        timestampMs: row.timestampMs,
      }))
      // Sort to ensure the timeline is chronological
      .sort((a, b) => a.timestampMs - b.timestampMs);
  });

  return Object.keys(grouped).length > 0 ? grouped : null;
}

export async function getWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[],
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  const expectedDates = getDateMsFromNow(timePeriod);
  const start = expectedDates[0];
  const end = expectedDates[expectedDates.length - 1];
  const now = dayjs.utc().valueOf();

  // Get existing records from DB
  const existing = await db
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

  if (existing.length == 0) {
    return fetchWalletTokenBalanceHistory(address, tokenAddresses, timePeriod);
  }

  // Group existing data by token address
  const tokenDataMap = new Map<string, typeof existing>();

  for (const row of existing) {
    if (!tokenDataMap.has(row.tokenAddress)) {
      tokenDataMap.set(row.tokenAddress, []);
    }
    tokenDataMap.get(row.tokenAddress)!.push(row);
  }

  // Collect all missing timestamps across all tokens
  const missingTimestamps = new Set<number>();
  for (const token of tokenAddresses) {
    const tokenData = tokenDataMap.get(token) || [];

    // Check each expected date per token
    for (let i = 0; i < expectedDates.length; i++) {
      const expectedDate = expectedDates[i];
      const isCurrentDay = i == expectedDates.length - 1;

      if (isCurrentDay) {
        // For current day, check if we have data within cache TTL of now
        const todayData = tokenData.find((r) => {
          const dayOfRecord = dayjs.utc(r.timestampMs).endOf("day").valueOf();
          const dayOfNow = dayjs.utc(now).endOf("day").valueOf();
          return dayOfRecord == dayOfNow;
        });

        if (
          !todayData ||
          now - todayData.timestampMs > WALLET_BALANCE_HISTORY_CACHE_TTL_MS
        ) {
          missingTimestamps.add(now);
        }
      } else {
        // For historical dates, check if we have data for that day (end of day)
        const dayEndOfDay = dayjs.utc(expectedDate).endOf("day").valueOf();
        const hasDataForDay = tokenData.some((r) => {
          const recordDayEndOfDay = dayjs
            .utc(r.timestampMs)
            .endOf("day")
            .valueOf();
          return recordDayEndOfDay == dayEndOfDay;
        });

        if (!hasDataForDay) {
          missingTimestamps.add(expectedDate);
        }
      }
    }
  }

  // If there are gaps, fetch only those timestamps
  if (missingTimestamps.size > 0) {
    const resArray = await Promise.all(
      Array.from(missingTimestamps).map((timestamp) =>
        bdsFetchAssetsAt(address, timestamp, tokenAddresses),
      ),
    );

    const insertValues = resArray.flatMap(
      (res) =>
        res?.allAssets.map(
          (tokenBalance): WalletTokenBalanceHistoryInsert => ({
            address: address,
            timestampMs: dayjs.utc(res.timestampMs).valueOf(),
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
    const combinedRecords = [...existing, ...(newData || [])];

    return groupTokenHistory(
      combinedRecords.map((row) => ({
        tokenAddress: row.tokenAddress,
        value: row.tokenBalance,
        usdValue: row.usdValue,
        timestampMs: row.timestampMs,
      })),
    );
  }

  if (existing.length > 0) {
    return groupTokenHistory(
      existing.map((row) => ({
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
  const dates = getDateMsFromNow(timePeriod);

  const resArray = await Promise.all(
    dates.map((date) => bdsFetchAssetsAt(address, date, tokenAddresses)),
  );

  const insertValues = resArray.flatMap(
    (res) =>
      res?.allAssets.map(
        (tokenBalance): WalletTokenBalanceHistoryInsert => ({
          address: address,
          timestampMs: dayjs.utc(res.timestampMs).valueOf(),
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

async function bdsFetchAssetsAt(
  walletAddress: string,
  timestampMs: number,
  tokenAddresses: string[],
) {
  const formattedTime = dayjs.utc(timestampMs).format("YYYY-MM-DD HH:mm:ss");

  const requestedTokens = new Set(tokenAddresses);

  const allAssets: BDS_WalletNetAssets["data"]["net_assets"] = [];
  const matchAssets = new Map<
    string,
    BDS_WalletNetAssets["data"]["net_assets"][number]
  >();

  const limit = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = bds.getEndpoint("/wallet/v2/net-worth-details");

    url.search = new URLSearchParams({
      wallet: walletAddress,
      type: "1d",
      sort_type: "desc",
      limit: String(limit),
      offset: String(offset),
      time: formattedTime,
    }).toString();

    const resp = await rlFetch(url, {
      method: "GET",
      headers: bds.getRequiredHeaders(),
      rlLimiter: bds.limiter,
    });

    const res = await getTrackedApiResult(bds_WalletNetAssetsSchema, resp);

    if (!res) {
      return null;
    }

    total = res.pagination.total;

    for (const asset of res.data.net_assets) {
      const address = asset.token_address;
      if (requestedTokens.has(address) && !matchAssets.has(address)) {
        matchAssets.set(address, asset);
      }
      allAssets.push(asset);
    }

    // Stop early once we've found everything requested
    if (matchAssets.size == requestedTokens.size) {
      break;
    }

    offset += limit;
  }

  return {
    allAssets,
    timestampMs,
  };
}
