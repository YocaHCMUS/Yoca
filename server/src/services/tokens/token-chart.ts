import {
  TOKEN_CHART_24H_UPDATE_THRESHOLD,
  TOKEN_CHART_DAILY_FETCH_RANGE_MS,
  TOKEN_CHART_DAILY_UPDATE_THRESHOLD,
  TOKEN_CHART_HOURLY_FETCH_RANGE_MS,
  TOKEN_CHART_HOURLY_UPDATE_THRESHOLD,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { trackedFetch } from "@sv/services/tracking/apiCallTracker.service.js";
import {
  tokenMarketChart24h,
  tokenMarketChartDaily,
  tokenMarketChartHourly,
  type TokenMarketChart24hInsert,
  type TokenMarketChartDailyInsert,
  type TokenMarketChartHourlyInsert,
} from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte, lte } from "drizzle-orm";
import type { CG_TokenMarketChart } from "../_types/token-raw-responses.js";
import { getCoinGeckoIdsByAddresses } from "./token-list.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart-range
export async function fetch24hTokenMarketChart(
  tokenAddress: string,
  latestUpdateUnixMs: number | null = null,
) {
  if (!tokenAddress) {
    return [];
  }

  const cgIdLookup = await getCoinGeckoIdsByAddresses([tokenAddress]);
  const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;

  if (!cgId) {
    return [];
  }

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart/range`);

  const to = new Date().getTime();
  let from = to - 86_400_000;

  if (latestUpdateUnixMs && from < latestUpdateUnixMs) {
    from = latestUpdateUnixMs;
  }

  // "from" and "to" can either be in seconds or miliseconds.
  // Using miliseconds here
  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    from: from.toString(),
    to: to.toString(),
  }).toString();
  const resp = await trackedFetch({
    provider: "unknown",
    url: cgEndpoint,
    init: {
      method: "GET",
      headers: cg.getRequiredHeaders(),
    },
    serviceFile: "server/src/services/tokens/token-chart.ts",
    functionName: "fetch24hTokenMarketChart",
  });

  if (resp.ok) {
    const res = (await resp.json()) as CG_TokenMarketChart;
    const chartDataPoints = res.prices.map(
      ([timestamp, price], index): TokenMarketChart24hInsert => ({
        address: tokenAddress,
        unixTimestampMs: timestamp,
        price: price,
        marketCap: res.market_caps[index][1],
        totalVolume: res.total_volumes[index][1],
      }),
    );
    if (chartDataPoints.length == 0) {
      return [];
    }

    const chartData = await db
      .insert(tokenMarketChart24h)
      .values(chartDataPoints)
      .onConflictDoUpdate({
        target: [
          tokenMarketChart24h.address,
          tokenMarketChart24h.unixTimestampMs,
        ],
        set: {
          price: excluded(tokenMarketChart24h.price),
          marketCap: excluded(tokenMarketChart24h.marketCap),
          totalVolume: excluded(tokenMarketChart24h.totalVolume),
        },
      })
      .returning();

    return chartData;
  }

  return [];
}

export async function get24hTokenMarketChart(tokenAddress: string) {
  const to = new Date().getTime();
  const from = to - 86_400_000;

  const chartData = await db
    .select()
    .from(tokenMarketChart24h)
    .where(
      and(
        eq(tokenMarketChart24h.address, tokenAddress),
        gte(tokenMarketChart24h.unixTimestampMs, from),
        lte(tokenMarketChart24h.unixTimestampMs, to),
      ),
    )
    .orderBy(tokenMarketChart24h.unixTimestampMs);

  if (chartData.length == 0) {
    return fetch24hTokenMarketChart(tokenAddress);
  }

  const latestUpdate = chartData[chartData.length - 1].unixTimestampMs;
  const isStale =
    new Date().getTime() - latestUpdate > TOKEN_CHART_24H_UPDATE_THRESHOLD;

  if (isStale) {
    const newerChartData = await fetch24hTokenMarketChart(
      tokenAddress,
      latestUpdate,
    );

    if (newerChartData) {
      return [...chartData, ...newerChartData];
    }
  }

  return chartData;
}

// https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart
// For the overview page chart (multiple day ranges, proxied directly)
// export async function getTokenMarketChart(
//   tokenAddress: string,
//   days: number = 1,
// ) {
//   if (!tokenAddress) return null;

//   const cgIdLookup = await getCoinGeckoIdList([tokenAddress]);
//   const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;

//   if (!cgId) return null;

//   const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart`);
//   cgEndpoint.search = new URLSearchParams({
//     vs_currency: "usd",
//     days: days.toString(),
//   }).toString();

//   const req = new Request(cgEndpoint, {
//     method: "GET",
//     headers: cg.getRequiredHeaders(),
//   });

//   const resp = await fetch(req);
//   if (!resp.ok) return null;

//   const res: CG_TokenMarketChart = await resp.json();

//   return {
//     prices: res.prices,
//     marketCaps: res.market_caps,
//   };
// }

async function fetchAndCacheRangedChart(
  tokenAddress: string,
  cgId: string,
  table: typeof tokenMarketChartHourly | typeof tokenMarketChartDaily,
  fetchRangeMs: number,
): Promise<void> {
  const now = Date.now();
  const from = now - fetchRangeMs;

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart/range`);
  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    from: from.toString(),
    to: now.toString(),
  }).toString();

  const resp = await trackedFetch({
    provider: "unknown",
    url: cgEndpoint,
    init: {
      method: "GET",
      headers: cg.getRequiredHeaders(),
    },
    serviceFile: "server/src/services/tokens/token-chart.ts",
    functionName: "fetchAndCacheRangedChart",
  });
  if (!resp.ok) return;

  const res = (await resp.json()) as CG_TokenMarketChart;
  if (res.prices.length == 0) return;

  const unixUpdatedAtMs = now;
  const points = res.prices.map(
    (
      [timestamp, price],
      index,
    ): TokenMarketChartHourlyInsert | TokenMarketChartDailyInsert => ({
      address: tokenAddress,
      unixTimestampMs: timestamp,
      price: price,
      marketCap: res.market_caps[index][1],
      totalVolume: res.total_volumes[index][1],
      unixUpdatedAtMs,
    }),
  );

  await db
    .insert(table)
    .values(points)
    .onConflictDoUpdate({
      target: [table.address, table.unixTimestampMs],
      set: {
        price: excluded(table.price),
        marketCap: excluded(table.marketCap),
        totalVolume: excluded(table.totalVolume),
        unixUpdatedAtMs: excluded(table.unixUpdatedAtMs),
      },
    });
}

export async function getHourlyTokenMarketChart(
  tokenAddress: string,
  days: number,
) {
  if (!tokenAddress) return [];

  const cgIdLookup = await getCoinGeckoIdsByAddresses([tokenAddress]);
  const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;
  if (!cgId) return [];

  const requestedFrom = Date.now() - days * 24 * 60 * 60 * 1000;

  const cached = await db
    .select()
    .from(tokenMarketChartHourly)
    .where(
      and(
        eq(tokenMarketChartHourly.address, tokenAddress),
        gte(tokenMarketChartHourly.unixTimestampMs, requestedFrom),
      ),
    )
    .orderBy(tokenMarketChartHourly.unixTimestampMs);

  const latestUpdatedAt =
    cached.length > 0 ? cached[cached.length - 1].unixUpdatedAtMs : 0;
  const isStale =
    Date.now() - latestUpdatedAt > TOKEN_CHART_HOURLY_UPDATE_THRESHOLD;

  if (cached.length == 0 || isStale) {
    await fetchAndCacheRangedChart(
      tokenAddress,
      cgId,
      tokenMarketChartHourly,
      TOKEN_CHART_HOURLY_FETCH_RANGE_MS,
    );

    return db
      .select()
      .from(tokenMarketChartHourly)
      .where(
        and(
          eq(tokenMarketChartHourly.address, tokenAddress),
          gte(tokenMarketChartHourly.unixTimestampMs, requestedFrom),
        ),
      )
      .orderBy(tokenMarketChartHourly.unixTimestampMs);
  }

  return cached;
}

export async function getDailyTokenMarketChart(
  tokenAddress: string,
  days: number,
) {
  if (!tokenAddress) return [];

  const cgIdLookup = await getCoinGeckoIdsByAddresses([tokenAddress]);
  const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;
  if (!cgId) return [];

  const requestedFrom = Date.now() - days * 24 * 60 * 60 * 1000;

  const cached = await db
    .select()
    .from(tokenMarketChartDaily)
    .where(
      and(
        eq(tokenMarketChartDaily.address, tokenAddress),
        gte(tokenMarketChartDaily.unixTimestampMs, requestedFrom),
      ),
    )
    .orderBy(tokenMarketChartDaily.unixTimestampMs);

  const latestUpdatedAt =
    cached.length > 0 ? cached[cached.length - 1].unixUpdatedAtMs : 0;
  const isStale =
    Date.now() - latestUpdatedAt > TOKEN_CHART_DAILY_UPDATE_THRESHOLD;

  if (cached.length == 0 || isStale) {
    await fetchAndCacheRangedChart(
      tokenAddress,
      cgId,
      tokenMarketChartDaily,
      TOKEN_CHART_DAILY_FETCH_RANGE_MS,
    );

    return db
      .select()
      .from(tokenMarketChartDaily)
      .where(
        and(
          eq(tokenMarketChartDaily.address, tokenAddress),
          gte(tokenMarketChartDaily.unixTimestampMs, requestedFrom),
        ),
      )
      .orderBy(tokenMarketChartDaily.unixTimestampMs);
  }

  return cached;
}
