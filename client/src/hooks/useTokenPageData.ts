import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { client } from "../api/main";

// Define backend API types
const $getChart = client.api.tokens.markets.chart[":address"].$get;
const $getMarket = client.api.tokens.markets[":addresses"].$get;
const $getMeta = client.api.tokens.meta[":addresses"].$get;
const $getHolders = client.api.tokens.holders[":address"].$get;
const $getTrades = client.api.tokens.trades[":network"][":address"].$get;

export type ChartData = InferResponseType<typeof $getChart, 200>;
export type MarketData =
  | InferResponseType<typeof $getMarket, 200>[number]
  | null;
export type MetaData = InferResponseType<typeof $getMeta, 200>[number] | null;
export type TopHoldersData = InferResponseType<typeof $getHolders, 200>;
export type TradesData = InferResponseType<typeof $getTrades, 200>;
export interface HoldersInfo {
  holders_count: number;
  top_10_percent: number;
}

export interface PoolData {
  name: string;
  address: string;
  source?: string; // e.g. "orca", "raydium"
  volume24h: number;
  volumeBuy24h?: number;
  volumeSell24h?: number;
  volumeNet24h?: number;
  priceQuoteToken?: number; // Price in quote token (e.g. SOL)
  quoteToken?: {
    symbol: string;
  };
  baseToken?: {
    name: string;
    symbol: string;
    address: string;
  };
  reserve: number;
  liquidity?: number;
  marketCap?: number;
  fdv?: number;
  priceUsd?: number;
  priceChange?: {
    m5: number;
    h1: number;
    h6: number;
    h24: number;
  };
  txns24h?: number;
  buys24h?: number;
  sells24h?: number;
  traders24h?: number;
  buyers24h?: number;
  sellers24h?: number;
}

export const useTokenPageData = (address: string | undefined) => {
  const [chartData, setChartData] = useState<ChartData>([]);
  const [marketData, setMarketData] = useState<MarketData>(null);
  const [metaData, setMetaData] = useState<MetaData>(null);
  const [poolsData, setPoolsData] = useState<PoolData[]>([]);
  const [topHolders, setTopHolders] = useState<TopHoldersData>([]);
  const [holdersInfo, setHoldersInfo] = useState<HoldersInfo | null>(null);
  const [tradesData, setTradesData] = useState<TradesData>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;

    (async () => {
      setLoading(true);

      // 1. Fetch Backend Data (Meta, Market, Chart, Holders, Trades)
      const fetchBackendData = async () => {
        try {
          // Try to fetch trades for the pool. We need to know which pool address to use.
          // IMPORTANT: The 'address' param here is the TOKEN address (from URL /tokens/:address).
          // But trades API requires POOL address.
          // We fetch poolsData on the client side, or we might have them from a previous call?
          // Actually, useTokenPageData fetches poolsData in parallel.
          // We need a pool address to fetch trades.
          // The user's request showed using a pool address for trades.
          // The logic in TokenPage selects the first pool by default.
          // Maybe we should fetch trades AFTER we verify the pool, or just fetch trades for the first gathered pool?
          //
          // Current flow:
          // useTokenPageData fetches Meta, Market, Chart (using token addr), and Pools (using token addr).
          // The trades API requires a POOL address.
          // Let's defer fetching trades until we have a pool address?
          // Or... refactor useTokenPageData to accept a poolAddress?
          //
          // For now, to keep it simple and efficient:
          // We'll fetch Pools first, then fetch trades for the Top 1 Pool?
          // Or maybe we add a separate hook or function for fetching trades when a pool is selected?

          // Actually, the structure of TokenPage has `selectedPool`.
          // It would be better to fetch trades based on `selectedPool` inside TokenPage,
          // or add a new hook `usePoolTrades(poolAddress)`.

          // Let's modify this hook to ONLY fetch token-level data?
          // But the user wants "Recent Transactions" which are usually pool-specific.
          //
          // Wait, `TopPools` fetches top 20 pools.
          // Let's return a `fetchTrades` function from this hook or create a new hook.
          // The `useTokenPageData` is getting too big. A new hook is better.

          const [chartResp, marketResp, metaResp, holdersResp] =
            await Promise.all([
              $getChart({ param: { address } }),
              $getMarket({ param: { addresses: address } }),
              $getMeta({ param: { addresses: address } }),
              $getHolders({ param: { address } }),
            ]);

          if (chartResp.ok) setChartData(await chartResp.json());
          if (marketResp.ok) {
            const data = await marketResp.json();
            setMarketData(data[0]);
          }
          if (metaResp.ok) {
            const data = await metaResp.json();
            setMetaData(data[0]);
          }
          if (holdersResp.ok) {
            setTopHolders(await holdersResp.json());
          }
        } catch (error) {
          console.error("Failed to fetch backend data:", error);
        }
      };

      // 2. Fetch Client-side Data (Top 20 Pools & Holders Info)
      const fetchClientData = async () => {
        try {
          const { fetchTokenPools, fetchTokenHoldersInfo } = await import(
            "../services/coingecko"
          );

          // Parallel fetch for pools and holders info
          // Note: fetchTokenPools handles error internally and returns []
          // fetchTokenHoldersInfo handles error internally and returns null
          const [pools, holdersInfoData] = await Promise.all([
            fetchTokenPools(address, "solana", 20),
            fetchTokenHoldersInfo(address, "solana"),
          ]);

          setPoolsData(pools);
          if (holdersInfoData) {
            setHoldersInfo(holdersInfoData);
          }
        } catch (error) {
          console.error("Failed to fetch client data:", error);
        }
      };

      await Promise.all([fetchBackendData(), fetchClientData()]);

      setLoading(false);
    })();
  }, [address]);

  return {
    chartData,
    marketData,
    metaData,
    poolsData,
    topHolders,
    holdersInfo,
    loading,
  };
};

export const usePoolTrades = (
  network: string,
  poolAddress: string | undefined,
) => {
  const [trades, setTrades] = useState<TradesData>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!poolAddress || !network) return;

    (async () => {
      setLoading(true);
      try {
        const response = await $getTrades({
          param: { network, address: poolAddress },
        });
        if (response.ok) {
          setTrades(await response.json());
        }
      } catch (error) {
        console.error("Failed to fetch trades:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [network, poolAddress]);

  return { trades, loading };
};
