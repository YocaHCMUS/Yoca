// client/src/hooks/useTokenPageLogic.ts

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useTokenPageData, usePoolTrades } from "./useTokenPageData";
import type { PoolData } from "./useTokenPageData";
import { fetchPoolDetails } from "../services/coingecko";

export const useTokenPageLogic = (address: string | undefined, poolAddress: string | undefined) => {
    const navigate = useNavigate();
    const { marketData: backendMarketData, metaData: backendMetaData, poolsData, topHolders, holdersInfo, loading: loadingData } = useTokenPageData(address);

    // Fallback logic: If backend data is missing, try to use data from the top pool
    const hasBackendData = !!backendMarketData && !!backendMetaData;
    const fallbackPool = poolsData.length > 0 ? poolsData[0] : null;

    const marketData = hasBackendData ? backendMarketData : (fallbackPool ? {
        id: address || "unknown",
        symbol: fallbackPool.baseToken?.symbol || "Unknown",
        name: fallbackPool.baseToken?.name || "Unknown",
        image: "",
        currentPrice: fallbackPool.priceUsd || 0,
        marketCap: fallbackPool.marketCap || 0,
        marketCapRank: 0,
        fullyDilutedValuation: fallbackPool.fdv || 0,
        totalVolume: fallbackPool.volume24h || 0,
        high24h: 0,
        low24h: 0,
        priceChange24h: 0, // Absolute change not available in pool data
        priceChangePercentage1h: fallbackPool.priceChange?.h1 || 0,
        priceChangePercentage24h: fallbackPool.priceChange?.h24 || 0,
        priceChangePercentage7d: 0,
        circulatingSupply: 0,
        totalSupply: 0, // could estimate from FDV / Price if needed
        maxSupply: null,
        ath: 0,
        athChangePercentage: 0,
        athDate: "",
        atl: 0,
        atlChangePercentage: 0,
        atlDate: "",
        lastUpdated: new Date().toISOString(),
        // Add mapped fields for UI components that use camelCase or specific property names provided by the backend response
        priceUsd: fallbackPool.priceUsd || 0,
        // Ensure to matche the shape expected by MarketStats
    } as any : null);

    const metaData = hasBackendData ? backendMetaData : (fallbackPool ? {
        address: address || "",
        symbol: fallbackPool.baseToken?.symbol || "Unknown",
        name: fallbackPool.baseToken?.name || "Unknown",
        imageUrl: null,
        description: "Data provided by On-chain Dex",
        coinGeckoId: null
    } as any : null);

    // 2. Local state for selected pool
    const [selectedPool, setSelectedPool] = useState<PoolData | null>(null);

    // 3. Auto-select logic
    useEffect(() => {
        // If URL has poolAddress, prioritize it!
        if (poolAddress) {
            // Check if it's already selected
            if (selectedPool?.address === poolAddress) return;

            // Try to find in loaded pools
            const found = poolsData.find((p) => p.address === poolAddress);
            if (found) {
                setSelectedPool(found);
                return;
            }

            // If not found in list, we MUST still select it to fetch details
            // Create a minimal placeholder
            setSelectedPool({
                address: poolAddress,
                name: "Loading...",
                volume24h: 0,
                reserve: 0,
                priceUsd: 0,
                priceChange: { m5: 0, h1: 0, h6: 0, h24: 0 },
            } as PoolData);
            return;
        }

        // Fallback to first pool if no selection or not found (and not already selected)
        if (poolsData.length > 0 && !selectedPool) {
            setSelectedPool(poolsData[0]);
        }
    }, [poolsData, poolAddress, selectedPool]);

    // 4. Fetch trades AND DETAILED STATS for selected pool
    const { trades } = usePoolTrades("solana", selectedPool?.address);

    // Fetch detailed stats (buy/sell volume) when pool is selected
    useEffect(() => {
        if (selectedPool?.address) {
            // Use static import function directly
            (async () => {
                try {
                    const detailedPool = await fetchPoolDetails(selectedPool.address, "solana");

                    if (detailedPool) {
                        setSelectedPool(prev => {
                            const shouldUpdate = prev?.address === detailedPool.address;
                            if (shouldUpdate) {
                                // Force a new object reference even if some fields are same, just to be sure
                                return { ...detailedPool };
                            }
                            return prev;
                        });
                    }
                } catch (err) {
                    console.error("Failed to fetch pool details", err);
                }
            })();
        }
    }, [selectedPool?.address]);

    // 5. Handlers
    const handlePoolChange = ({ selectedItem }: { selectedItem: PoolData | null }) => {
        if (selectedItem) {
            setSelectedPool(selectedItem);
            // Update URL
            if (address) {
                navigate(`/tokens/${address}/${selectedItem.address}`);
            }
        }
    };

    return {
        // Data
        marketData,
        metaData,
        poolsData,
        topHolders,
        holdersInfo,
        selectedPool,
        trades,
        // Loading state
        loading: loadingData,
        // Actions
        handlePoolChange,
    };
};
