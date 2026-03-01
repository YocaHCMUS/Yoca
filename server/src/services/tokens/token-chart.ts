import { TOKEN_CHART_24H_UPDATE_THRESHOLD } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenMarketChart24h,
  type TokenMarketChart24hInsert,
} from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte, lte } from "drizzle-orm";
import type { CG_TokenMarketChart } from "../_types/token_raw_responses.js";
import { getCoinGeckoIdList } from "./token-list.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart-range
export async function fetch24hTokenMarketChart(
  tokenAddress: string,
  latestUpdateUnixMs: number | null = null,
) {
  if (!tokenAddress) {
    return [];
  }

  const cgIdLookup = await getCoinGeckoIdList([tokenAddress]);
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
  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (resp.ok) {
    const res: CG_TokenMarketChart = await resp.json();
    const chartDataPoints = res.prices.map(
      ([timestamp, price], index): TokenMarketChart24hInsert => ({
        address: tokenAddress,
        unixTimestampMs: timestamp,
        price: price,
        marketCap: res.market_caps[index][1],
        totalVolume: res.total_volumes[index][1],
      }),
    );
    if (chartDataPoints.length === 0) {
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
    );

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
export async function getTokenMarketChart(
  tokenAddress: string,
  days: number | "max" = 1,
) {
  if (!tokenAddress) return null;

  const cgIdLookup = await getCoinGeckoIdList([tokenAddress]);
  const cgId = cgIdLookup ? cgIdLookup[tokenAddress] : null;

  if (!cgId) return null;

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart`);
  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    days: days.toString(),
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) return null;

  const res: CG_TokenMarketChart = await resp.json();

  return {
    prices: res.prices as [number, number][],
    marketCaps: res.market_caps as [number, number][],
  };
}

