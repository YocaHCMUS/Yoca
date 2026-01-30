
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import type { ChartResponseBase } from '@/types/chart-api.types';
import type { ChartLoadingState } from '@/types/chart.types';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { useChartFilters } from '@/hooks/useChartFilters';
import type { ChartFilters } from '@/types/chart-filters.types';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';


export enum ChartType {
    Line,
    Bar,
    Pie,
    Heatmap,
    Treemap,
    Area,
    Scatter,
    Custom,
}

// Universal chart config type, based on EChartsOption
export type ChartConfig = EChartsOption;

export interface ChartProps {
    /** Chart title */
    title?: string;

    /** Chart height in pixels */
    height?: number;

    /** Chart type */
    type: ChartType;

    /** ECharts configuration */
    config: ChartConfig;

    /** Optional loading state */
    loading?: boolean;

    /** Optional error state */
    error?: string;

    /** Initial filters (optional, for charts that support filtering) */
    initialFilters?: Partial<ChartFilters>;

    features?: {export?: boolean, fullscreen?: boolean};

    fetchData: (filters: ChartFilters) => Promise<any>; 
}

export const Chart: React.FC<ChartProps> = ({
    title,
    height = 400,
    type,
    config,
    loading: loadingProp,
    error: errorProp,
    initialFilters,
    features,
    fetchData
}) => {
    const { t } = useTranslation();
    const chartTitle = title;

    // Chart instance ref for export
    const chartRef = useRef<ReactECharts>(null);
    const [data, setData] = React.useState<ChartResponseBase | null>(null);
    const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
        status: 'idle',
        retryCount: 0,
    });

    // State for loading, error, and data 
    const [loading, setLoading] = useState<boolean>(!!loadingProp);
    const [error, setError] = useState<string | undefined>(errorProp);
    const [empty, setEmpty] = useState<boolean>(false);

    const isMountedRef = useRef(true);

    // Get timezone from context
    const { selectedTimezone: timezone } = useChartContext();

    // Get theme configuration
    const chartTheme = useChartTheme();

    // Chart filters with debouncing
    const {
        filters,
        setTimePeriod,
        setWallets,
        isValid,
    } = useChartFilters({
        initialFilters: initialFilters,
        debounceDelay: 300,
    });



    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        setError(undefined);
        fetchData(filters)
            .then(data => {
            if (!isMounted) return;
                setData(data);
                setLoading(false);
                setEmpty(checkIfEmpty(data));
            })
            .catch(err => {
                if (!isMounted) return;
                setError(err.message || 'Error');
                setLoading(false);
            });
        return () => { isMounted = false; };
    }, [filters, fetchData]);

    // Cleanup on unmount
    useEffect(() => {
    return () => {
        isMountedRef.current = false;
    };
    }, []);
    
    // Fetch data on filter changes
    useEffect(() => {
        fetchData(filters);
    }, [fetchData]);
    
    // Auto-refresh with pause detection
    // Define enableAutoRefresh (default to true, or customize as needed)
    const enableAutoRefresh = true;
    // Define refreshInterval (default to 60000ms, or customize as needed)
    const refreshInterval = 60000;
    useAutoRefresh({
        onRefresh: () => fetchData(filters),
        config: {
            enabled: true,
            interval: refreshInterval,
            pauseOnInteraction: true,
        },
        enabled: enableAutoRefresh && loadingState.status === 'success',
    });

    // Render loading, error, or empty states
    if (loading) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.loading', 'Loading...')}
            </div>
        );
    }
    if (error) {
        return (
            <div style={{ height, color: 'red', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.error', 'Error:')} {error}
            </div>
        );
    }
    if (empty) {
        return (
            <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {t('charts.noData', 'No data available')}
            </div>
        );
    }

    // Render the chart
    return (
        <div style={{ width: '100%' }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>{chartTitle}</div>
            <ReactECharts
                ref={chartRef}
                option={config}
                style={{ height: `${height}px`, width: '100%' }}
                notMerge={true}
                lazyUpdate={true}
                opts={{ renderer: 'canvas' }}
            />
            {/* Add export/fullscreen controls here if features prop is enabled */}
        </div>
    );
}

function checkIfEmpty(data: any): React.SetStateAction<boolean> {
    throw new Error('Function not implemented.');
}
