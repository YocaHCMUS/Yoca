import type { ChartLoadingState } from "@/types/chart.types";
import { useState, useRef, useCallback, useEffect } from "react";
import { useAutoRefresh } from "./useAutoRefresh";

interface StandardChartConfig<TData, TQuery> {
  fetcher: (query: TQuery) => Promise<TData>;
  query: TQuery;
  /** When `manual`, no fetch on mount or query change — call `refetch()` only. */
  fetchMode?: "auto" | "manual";
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
    fetchMode = "auto",
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

    const dataRef = useRef<TData | null>(null);
    const onDataLoadedRef = useRef(onDataLoaded);
    onDataLoadedRef.current = onDataLoaded;

    const fetchData = useCallback(async (isRefreshing = false) => {
        const queryKey = JSON.stringify(query);

        if (!isRefreshing && queryKey === lastQueryRef.current && dataRef.current !== null) {
            return;
        }

        if (!isRefreshing && cacheRef.current.has(queryKey)) {
            const cachedData = cacheRef.current.get(queryKey)!;
            setData(cachedData);
            dataRef.current = cachedData;
            setLoadingState({ status: 'success', retryCount: 0 });
            onDataLoadedRef.current?.(cachedData);
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
            dataRef.current = result;
            setLoadingState({ status: 'success', retryCount: 0 });
            
            cacheRef.current.set(queryKey, result);
            lastQueryRef.current = queryKey;
            
            if (cacheRef.current.size > 10) {
                const firstKey = cacheRef.current.keys().next().value;
                if (firstKey !== undefined) {
                    cacheRef.current.delete(firstKey);
                }
            }
            
            onDataLoadedRef.current?.(result);
        } catch (error) {
            console.error('[useChartController] Fetch failed', { query, error });
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
    }, [fetcher, query]);

    useAutoRefresh({
        onRefresh: () => fetchData(true),
        config: {
            enabled: autoRefresh,
            interval: refreshInterval,
            pauseOnInteraction: true,
        },
        enabled: fetchMode !== "manual" && autoRefresh && loadingState.status === 'success',
    });

    useEffect(() => {
        if (fetchMode === "manual") {
            return;
        }
        fetchData();
    }, [fetchData, fetchMode]);

    return { data, loadingState, refetch: fetchData };
}
