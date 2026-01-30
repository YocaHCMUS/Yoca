/**
 * useTokenData Hook
 * React hook to fetch and manage token market data from CoinGecko
 */

import { useState, useEffect, useCallback } from "react";
import {
    fetchTokenMarketData,
    fetchMultipleTokens,
    fetchTrendingTokens,
    fetchOnchainTokenData,
} from "../services/coingecko";
import type { TokenMarketData, TrendingToken, OnchainTokenData } from "../services/coingecko";

interface UseTokenDataResult {
    token: TokenMarketData | null;
    trendingTokens: TrendingToken[];
    onchainData: OnchainTokenData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Hook to fetch single token data with auto-refresh
 * Combines market data + onchain data (aggregated from all pools)
 */
export function useTokenData(
    coinId: string = "solana",
    refreshInterval: number = 60000 // 60 seconds
): UseTokenDataResult {
    const [token, setToken] = useState<TokenMarketData | null>(null);
    const [trendingTokens, setTrendingTokens] = useState<TrendingToken[]>([]);
    const [onchainData, setOnchainData] = useState<OnchainTokenData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);

            // Fetch all data in parallel
            const [tokenData, trending, onchain] = await Promise.all([
                fetchTokenMarketData(coinId),
                fetchTrendingTokens(),
                fetchOnchainTokenData(), // Aggregated from all pools
            ]);

            setToken(tokenData);
            setTrendingTokens(trending);
            setOnchainData(onchain);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch data");
            console.error("Error fetching token data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [coinId]);

    useEffect(() => {
        fetchData();

        // Auto-refresh
        const interval = setInterval(fetchData, refreshInterval);

        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    return {
        token,
        trendingTokens,
        onchainData,
        isLoading,
        error,
        refetch: fetchData,
    };
}

interface UseMultipleTokensResult {
    tokens: TokenMarketData[];
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Hook to fetch multiple tokens data
 */
export function useMultipleTokens(
    coinIds: string[] = ["solana", "bitcoin", "ethereum", "cardano", "dogecoin"],
    refreshInterval: number = 60000
): UseMultipleTokensResult {
    const [tokens, setTokens] = useState<TokenMarketData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const data = await fetchMultipleTokens(coinIds);
            setTokens(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to fetch data");
            console.error("Error fetching tokens:", err);
        } finally {
            setIsLoading(false);
        }
    }, [coinIds]);

    useEffect(() => {
        fetchData();

        const interval = setInterval(fetchData, refreshInterval);

        return () => clearInterval(interval);
    }, [fetchData, refreshInterval]);

    return {
        tokens,
        isLoading,
        error,
        refetch: fetchData,
    };
}
