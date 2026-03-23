import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import client from "../api/main";

// Define backend API types
const $getChart = client.api.tokens.markets.chart[":address"].$get;
const $getMarket = client.api.tokens.markets[":addresses"].$get;
const $getMeta = client.api.tokens.meta[":addresses"].$get;
const $getHolders = client.api.tokens.holders[":address"].$get;
const $getTrades = client.api.tokens.pools.trades[":address"].$get;
const $getPools = client.api.tokens[":address"].pools.$get;
const $getHoldersStats = client.api.tokens.holders.stats[":addresses"].$get;

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

      const fetchBackendData = async () => {
        try {
          const [chartResp, marketResp, metaResp, holdersResp, poolsResp, holdersStatsResp] =
            await Promise.all([
              $getChart({ param: { address } }),
              $getMarket({ param: { addresses: address } }),
              $getMeta({ param: { addresses: address } }),
              $getHolders({ param: { address } }),
              $getPools({ param: { address } }),
              $getHoldersStats({ param: { addresses: address } }),
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
          if (poolsResp.ok) {
            const poolsData = await poolsResp.json();
            setPoolsData(
              poolsData.slice(0, 20).map((pool: any) => {
                const p = pool.data;
                return {
                  name: p.poolName || "Unknown Pool",
                  address: p.poolAddress || "",
                  source: p.dexId || "unknown",
                  volume24h: Number(p.volumeUsd24h || 0),
                  volumeBuy24h: Number(p.buyVolumeUsd24h || 0),
                  volumeSell24h: Number(p.sellVolumeUsd24h || 0),
                  reserve: Number(p.liquidityUsd || 0),
                  liquidity: Number(p.liquidityUsd || 0),
                  marketCap: Number(p.marketCapUsd || 0),
                  fdv: Number(p.fdvUsd || 0),
                  priceUsd: Number(p.baseTokenPriceUsd || 0),
                  priceQuoteToken: Number(p.quoteTokenPriceUsd || 0),
                  priceChange: {
                    m5: Number(p.priceChangePercentage5m || 0),
                    h1: Number(p.priceChangePercentage1h || 0),
                    h6: Number(p.priceChangePercentage6h || 0),
                    h24: Number(p.priceChangePercentage24h || 0),
                  },
                  txns24h: Number((p.buys24h || 0) + (p.sells24h || 0)),
                  buys24h: Number(p.buys24h || 0),
                  sells24h: Number(p.sells24h || 0),
                  traders24h: Number((p.buyers24h || 0) + (p.sellers24h || 0)),
                  buyers24h: Number(p.buyers24h || 0),
                  sellers24h: Number(p.sellers24h || 0),
                };
              }),
            );
          }
          if (holdersStatsResp.ok) {
            const statsData = await holdersStatsResp.json();
            if (statsData.length > 0) {
              setHoldersInfo({
                holders_count: statsData[0].holdersCount,
                top_10_percent: statsData[0].top10Percent,
              });
            }
          }
        } catch (error) {
          console.error("Failed to fetch backend data:", error);
        }
      };

      await fetchBackendData();

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
          param: { address: poolAddress },
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
