import * as cg from "@sv/util/util-coingecko.js";
import { getCoinGeckoIdsByAddresses } from "./token-list.js";

export type HistoricalDataPoint = {
  dateStr: string; // "YYYY-MM-DD"
  timestampMs: number;
  price: number | null;
  marketCap: number | null;
  volume: number | null;
};

type CG_MarketChart = {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
};

// https://docs.coingecko.com/v3.0.1/reference/coins-id-market-chart
export async function getTokenHistoricalData(
  tokenAddress: string,
  days: number,
): Promise<HistoricalDataPoint[] | null> {
  const cgIdLookup = await getCoinGeckoIdsByAddresses([tokenAddress]);
  const cgId = cgIdLookup?.[tokenAddress];

  if (!cgId) return null;

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}/market_chart`);
  cgEndpoint.search = new URLSearchParams({
    vs_currency: "usd",
    days: days.toString(),
    interval: "daily",
    precision: "full",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) return null;

  const data: CG_MarketChart = await resp.json();

  // CoinGecko trả về dữ liệu mỗi ngày, index đồng bộ giữa prices/market_caps/total_volumes
  return data.prices.map(([ts, price], i): HistoricalDataPoint => {
    const date = new Date(ts);
    const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD
    return {
      dateStr,
      timestampMs: ts,
      price,
      marketCap: data.market_caps[i]?.[1] ?? null,
      volume: data.total_volumes[i]?.[1] ?? null,
    };
  });
}
