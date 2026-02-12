import type { ChartLoadingState } from "@/types/chart.types";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAutoRefresh } from "./useAutoRefresh";

interface StandardChartConfig<TData, TQuery> {
  fetcher: (query: TQuery) => Promise<TData>;
  query: TQuery;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onDataLoaded?: (data: TData) => void;
}

interface StandardChartController<TData> {
  data: TData | null;
  loadingState: ChartLoadingState;
  refetch: (isRefreshing?: boolean) => void;
}

export function useStandardChartController<TData, TQuery>({
    fetcher,
    query,
    autoRefresh = true,
    refreshInterval = 30000,
    onDataLoaded,
}: StandardChartConfig<TData, TQuery>): StandardChartController<TData> {
    const [data, setData] = useState<TData | null>(null);
    const [loadingState, setLoadingState] = useState<ChartLoadingState>({
        status: 'idle',
        retryCount: 0,
    });

    // Cache to track last fetched query
    const lastQueryRef = useRef<string | null>(null);
    const cacheRef = useRef<Map<string, TData>>(new Map());

    const fetchData = useCallback(async (isRefreshing = false) => {
        // Serialize query for comparison and caching
        const queryKey = JSON.stringify(query);

        // Skip fetch if query hasn't changed and we have data (unless refreshing)
        if (!isRefreshing && queryKey === lastQueryRef.current && data !== null) {
            return;
        }

        // Check cache for non-refreshing requests
        if (!isRefreshing && cacheRef.current.has(queryKey)) {
            const cachedData = cacheRef.current.get(queryKey)!;
            setData(cachedData);
            setLoadingState({ status: 'success', retryCount: 0 });
            onDataLoaded?.(cachedData);
            lastQueryRef.current = queryKey;
            return;
        }

        setLoadingState(prev => ({
            status: isRefreshing ? 'refreshing' : 'loading',
            retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
        }));

        try {
            const result = await fetcher(query);
            setData(result);
            setLoadingState({ status: 'success', retryCount: 0 });
            
            // Update cache
            cacheRef.current.set(queryKey, result);
            lastQueryRef.current = queryKey;
            
            // Limit cache size to prevent memory leaks (keep last 10 queries)
            if (cacheRef.current.size > 10) {
                const firstKey = cacheRef.current.keys().next().value;
                if (firstKey !== undefined) {
                    cacheRef.current.delete(firstKey);
                }
            }
            
            onDataLoaded?.(result);
        } catch (error) {
            setLoadingState(prev => ({
                status: 'error',
                retryCount: prev.retryCount,
                error: {
                code: 'FETCH_ERROR',
                message: error instanceof Error ? error.message : 'Fetch failed',
                retryable: true,
                },
            }));
        }
    }, [fetcher, query, data, onDataLoaded]);

    useAutoRefresh({
        onRefresh: () => fetchData(true),
        config: {
            enabled: autoRefresh,
            interval: refreshInterval,
            pauseOnInteraction: true,
        },
        enabled: autoRefresh && loadingState.status === 'success',
    });

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loadingState, refetch: fetchData };
}
