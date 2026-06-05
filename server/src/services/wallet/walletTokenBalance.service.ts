import { getTrackedApiResult } from "@sv/middlewares/validation.js";
import type { WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { zrn_WalletBalanceChartSchema } from "../_types/wallet-raw-responses.js";

import { db } from "@sv/db/index.js";
import {
  walletTokenBalanceMonthHistory,
  walletTokenBalanceWeekHistory,
  zerionTokenList,
} from "@sv/db/schema.js";
import { rlFetch } from "@sv/util/rate-limit.js";
import dayjs from "dayjs";
import { and, between, eq, gte, inArray } from "drizzle-orm";
import { WALLET_BALANCE_HISTORY_CACHE_TTL_MS } from "@sv/config/constants.js";
import * as zrn from "@sv/util/util-zerion.js";
import { zrn_FungiblesResponseSchema } from "../_types/token-raw-responses.js";

type WalletTokenBalanceHistory = Record<
  string,
  {
    usdValue: number;
    timestampMs: number;
  }[]
> | null;

async function getZerionId(
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  const res = await db
    .select()
    .from(zerionTokenList)
    .where(inArray(zerionTokenList.tokenAddress, tokenAddresses));

  if (res.length == 0) {
    return await fetchZerionId(tokenAddresses);
  }
  return Object.fromEntries(
    res.map((entry) => [entry.tokenAddress, entry.zerionId]),
  );
}

async function fetchZerionId(
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  // TODO: warn about token addresses limit of 25
  const url = zrn.getEndpoint("/v1/fungibles/");
  const req = new URL(url);

  // Filter by chain and addresses (comma-separated)
  req.search = new URLSearchParams({
    "filter[chain_ids]": "solana",
    "filter[addresses]": tokenAddresses.join(","),
  }).toString();

  const resp = await fetch(req, {
    method: "GET",
    headers: zrn.getRequiredHeaders(),
  });

  const res = await getTrackedApiResult(zrn_FungiblesResponseSchema, resp);

  if (!res) {
    return {};
  }

  // Build a map: token address (from implementations) -> Zerion ID (uuid)
  const idMap: Record<string, string> = {};
  for (const item of res.data) {
    const zerionId = item.id;
    // Find the Solana implementation address
    const solImpl = item.attributes.implementations.find(
      (impl) => impl.chain_id == "solana" && impl.address != null,
    );
    if (solImpl?.address) {
      idMap[solImpl.address] = zerionId;
    }
  }

  const insertValues = Object.entries(idMap).map(([addr, id]) => ({
    tokenAddress: addr,
    zerionId: id,
  }));

  await db.insert(zerionTokenList).values(insertValues).onConflictDoNothing();

  return idMap;
}

export async function getWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[],
  timePeriod: WalletTimePeriod = "30D",
): Promise<WalletTokenBalanceHistory> {
  // TODO: enforce this
  const toZrnChartPeriod: Record<any, "week" | "month"> = {
    "7D": "week",
    "30D": "month",
  };

  const zrnPeriod = toZrnChartPeriod[timePeriod];

  const nowUtc = dayjs().utc();
  const end = nowUtc.valueOf();
  const start = nowUtc.subtract(1, zrnPeriod).valueOf();
  const thresholdDateMs = end - WALLET_BALANCE_HISTORY_CACHE_TTL_MS;

  const balanceTable =
    zrnPeriod == "week"
      ? walletTokenBalanceWeekHistory
      : walletTokenBalanceMonthHistory;

  const res = await db
    .select()
    .from(balanceTable)
    .where(
      and(
        between(balanceTable.timestampMs, start, end),
        eq(balanceTable.walletAddress, address),
        inArray(balanceTable.tokenAddress, tokenAddresses),
        gte(balanceTable.timestampMs, thresholdDateMs),
      ),
    )
    .orderBy(balanceTable.tokenAddress, balanceTable.timestampMs);

  if (res.length == 0) {
    return await fetchWalletTokenBalanceHistory(
      address,
      tokenAddresses,
      zrnPeriod,
    );
  }

  const grouped = res.reduce((acc, value) => {
    if (!acc[value.tokenAddress]) {
      acc[value.tokenAddress] = [];
    }
    acc[value.tokenAddress].push({
      timestampMs: value.timestampMs,
      usdValue: value.usdValue,
    });
    return acc;
  }, {} as NonNullable<WalletTokenBalanceHistory>);

  // Check for missing token
  const missingTokens = tokenAddresses.filter((addr) => !grouped[addr]);
  if (missingTokens.length > 0) {
    const fetched = await fetchWalletTokenBalanceHistory(
      address,
      missingTokens,
      zrnPeriod,
    );
    return { ...grouped, ...fetched };
  }

  return grouped;
}

export async function fetchWalletTokenBalanceHistory(
  address: string,
  tokenAddresses: string[] = [],
  timePeriod: "week" | "month",
): Promise<WalletTokenBalanceHistory> {
  const idLookup = await getZerionId(tokenAddresses);

  if (Object.keys(idLookup).length == 0) {
    return null;
  }

  const zerionIdMap = tokenAddresses
    .map((addr) => ({ addr, id: idLookup[addr] }))
    .filter((item) => item.id);

  const resArray = await Promise.all(
    zerionIdMap.map(async ({ addr, id }) => {
      // TODO: warn about token addresses limit of 25
      const url = zrn.getEndpoint(`/wallets/${address}/charts/${timePeriod}`);
      const req = new URL(url);
      req.search = new URLSearchParams({
        currency: "usd",
        "filter[positions]": "only_simple",
        "filter[chain_ids]": "solana",
        "filter[fungible_ids]": id,
      }).toString();

      // Use the shared limiter
      const resp = await rlFetch(req, {
        rlLimiter: zrn.limiter,
        method: "GET",
        headers: zrn.getRequiredHeaders(),
        rlRetries: 3,
        rlRetryDelayMs: 500,
        rlTimeoutMs: 30000,
      });

      const res = await getTrackedApiResult(zrn_WalletBalanceChartSchema, resp);
      if (!res) {
        return res;
      }

      return { ...res, addr };
    }),
  );

  const insertValues = resArray
    .filter((entry) => !!entry)
    .flatMap((entry) =>
      entry.data.attributes.points.map((point) => ({
        walletAddress: address,
        tokenAddress: entry.addr,
        // s -> ms
        timestampMs: point[0] * 1000,
        usdValue: point[1] * 1000,
      })),
    );

  const balanceTable =
    timePeriod == "week"
      ? walletTokenBalanceWeekHistory
      : walletTokenBalanceMonthHistory;

  await db.insert(balanceTable).values(insertValues).onConflictDoNothing();

  const grouped = insertValues.reduce((acc, value) => {
    if (!acc[value.tokenAddress]) {
      acc[value.tokenAddress] = [];
    }
    acc[value.tokenAddress].push({
      timestampMs: value.timestampMs,
      usdValue: value.usdValue,
    });
    return acc;
  }, {} as NonNullable<WalletTokenBalanceHistory>);

  return grouped;
}
