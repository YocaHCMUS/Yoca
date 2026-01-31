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

    const isMountedRef = useRef(true);

    const fetchData = useCallback(async (isRefreshing = false) => {
        setLoadingState(prev => ({
            status: isRefreshing ? 'refreshing' : 'loading',
            retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
        }));

        try {
            const result = await fetcher(query);
            if (!isMountedRef.current) return;

            setData(result);
            setLoadingState({ status: 'success', retryCount: 0 });
            onDataLoaded?.(result);
        } catch (error) {
            if (!isMountedRef.current) return;

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
    }, [fetcher, query, onDataLoaded]);

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
        return () => {
        isMountedRef.current = false;
        };
    }, [fetchData]);

    return { data, loadingState, refetch: fetchData };
}
