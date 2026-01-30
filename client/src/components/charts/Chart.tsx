
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import type { ChartResponseBase } from '@/types/chart-api.types';
import type { ChartLoadingState } from '@/types/chart.types';
import { useChartTheme } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { useChartFilters } from '@/hooks/useChartFilters';
import type { ChartFilters, ExportFormat } from '@/types/chart-filters.types';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { ChartWrapper } from './shared/ChartWrapper';


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
    title: string;

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

    classname?: string;
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
    fetchData,
    classname
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

    function checkIfEmpty(data: any): React.SetStateAction<boolean> {
        throw new Error('Function not implemented.');
    }

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

    function handleExport(format: ExportFormat): Promise<void> {
        throw new Error('Function not implemented.');
    }

    function handleRetry(): void {
        throw new Error('Function not implemented.');
    }

    const content = null
    function renderContent() {

    }

    // Render the chart
    return (
        <ChartWrapper
            title={chartTitle}
            loadingState={loadingState}
            height={height}
            onExport={handleExport}
            onRetry={handleRetry}
            isEmpty={empty}
            emptyState={{
                title: t('charts.noDataTitle'),
                message: t('charts.noDataMessage'),
                action: {
                label: t('charts.retry'),
                onClick: handleRetry,
                },
            }}
            className={classname}
            >
            {content}
        </ChartWrapper>
    );
}

