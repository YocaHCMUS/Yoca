import { useEffect, useState } from "react";
import type { InferResponseType } from "hono/client";
import client from "../api/main.js";
import { fetchOnchainTokenData } from "../services/coingecko";

// Define backend API types
const $getChart = client.api.tokens.markets.chart[":address"].$get;
const $getMarket = client.api.tokens.markets[":addresses"].$get;
const $getMeta = client.api.tokens.meta[":addresses"].$get;

export type ChartData = InferResponseType<typeof $getChart, 200>;
export type MarketData = InferResponseType<typeof $getMarket, 200>[number] | null;
export type MetaData = InferResponseType<typeof $getMeta, 200>[number] | null;

interface PoolData {
    name: string;
    address: string;
    volume24h: number;
    reserve: number;
}

export const useTokenPageData = (address: string | undefined) => {
    const [chartData, setChartData] = useState<ChartData>([]);
    const [marketData, setMarketData] = useState<MarketData>(null);
    const [metaData, setMetaData] = useState<MetaData>(null);
    const [poolsData, setPoolsData] = useState<PoolData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!address) return;

        (async () => {
            setLoading(true);

            // 1. Fetch Backend Data (Meta, Market, Chart)
            const fetchBackendData = async () => {
                try {
                    const [chartResp, marketResp, metaResp] = await Promise.all([
                        $getChart({ param: { address } }),
                        $getMarket({ param: { addresses: address } }),
                        $getMeta({ param: { addresses: address } }),
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
                } catch (error) {
                    console.error("Failed to fetch backend data:", error);
                }
            };

            // 2. Fetch Client-side Data (Onchain Pools)
            const fetchClientData = async () => {
                try {
                    const onchainData = await fetchOnchainTokenData("solana", address);
                    if (onchainData?.topPools) {
                        setPoolsData(onchainData.topPools);
                    }
                } catch (error) {
                    console.error("Failed to fetch onchain data:", error);
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
        loading,
    };
};
