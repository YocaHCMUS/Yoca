/**
 * PriceHistoryChart Component
 *
 * Displays price history line chart for selected tokens over time,
 * showing price trends and performance comparisons.
 *
 * @module PriceHistoryChart
 */

import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchPriceHistory } from '../../../services/chart/chartApi';
import { formatCurrency } from '../../../util/chart-helpers';
import type { PriceHistoryResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './PriceHistoryChart.module.scss';

/**
 * Props for PriceHistoryChart component
 */
interface PriceHistoryChartProps {
  /** Chart title */
  title?: string;

  /** Chart height in pixels */
  height?: number;

  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;

  /** Initial token selection */
  initialTokens?: string[];

  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;

  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;

  /** Callback when data is loaded */
  onDataLoaded?: (data: PriceHistoryResponse) => void;

  /** Additional CSS class */
  className?: string;
}

/**
 * PriceHistoryChart Component
 *
 * User Story: Track price movements and trends over time
 *
 * Displays line chart with:
 * - Price history for multiple tokens
 * - Time period filtering
 * - Token selection
 * - Auto-refresh every 30 seconds
 *
 * @example
 * ```tsx
 * <PriceHistoryChart
 *   title="Token Price History"
 *   height={400}
 *   initialTimePeriod="30D"
 *   initialTokens={['SOL', 'JTO']}
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function PriceHistoryChart({
  title,
  height = 400,
  initialTimePeriod = '30D',
  initialTokens = ['SOL', 'JTO', 'BONK'],
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: PriceHistoryChartProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.priceHistoryChart.title', 'Price History');

  // State management
  const [data, setData] = React.useState<PriceHistoryResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });

  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);

  // Get timezone from context (fallback to UTC if not available)
  let timezone = 'UTC';
  try {
    const chartContext = useChartContext();
    timezone = chartContext.selectedTimezone;
  } catch (error) {
    // ChartProvider not available, use UTC
    console.warn('ChartProvider not available, using UTC timezone');
  }

  // Get theme configuration
  const chartTheme = useChartTheme();

  // Filter management with time period and tokens
  const {
    filters,
    setTimePeriod,
    setTokens,
  } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
      tokens: initialTokens,
      transactionType: 'all',
    },
  });

  // Fetch data function
  const fetchData = React.useCallback(async () => {
    setLoadingState({ status: 'loading', retryCount: loadingState.retryCount });

    try {
      const response = await fetchPriceHistory({
        tokens: filters.tokens?.join(',') || 'SOL,JTO,BONK',
        period: filters.timePeriod,
        aggregation: 'daily',
      });

      setData(response);
      setLoadingState({ status: 'success', retryCount: 0 });
      onDataLoaded?.(response);
    } catch (error) {
      console.error('Failed to fetch price history data:', error);
      setLoadingState({
        status: 'error',
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load data',
          retryable: true,
        },
        retryCount: loadingState.retryCount + 1,
      });
    }
  }, [filters.tokens, filters.timePeriod, loadingState.retryCount, onDataLoaded]);

  // Initial data load and filter changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-refresh setup
  useAutoRefresh({
    enabled: enableAutoRefresh,
    onRefresh: fetchData,
    config: {
      interval: refreshInterval,
    },
  });

  // Export functionality
  const { exportChart } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'price-history',
  });

  // Handle export
  const handleExport = async (format: ExportFormat) => {
    const echartsInstance = chartRef.current?.getEchartsInstance();
    const chartInstance = echartsInstance ? (echartsInstance as any) : null;

    // Prepare CSV data
    const csvData = data ? data.series.map(series => ({
      id: series.symbol,
      name: series.name,
      type: 'line' as const,
      data: series.data.map(point => ({
        category: new Date(point.timestamp).toISOString(),
        value: point.value,
      })),
      visible: true,
    })) : [];

    exportChart(format, chartInstance, csvData, filters);
  };

  // Generate chart options
  const chartOptions: EChartsOption = useMemo(() => {
    if (!data || data.series.length === 0) {
      return {};
    }

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Check if we need logarithmic scale (when price ranges differ significantly)
    const allPrices = data.series.flatMap(series => series.data.map(point => point.value));
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    const priceRangeRatio = maxPrice / minPrice;
    const useLogScale = priceRangeRatio > 1000; // Use log scale if range is > 1000x

    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params)) return '';

          const date = new Date(params[0].axisValue).toLocaleDateString();
          let tooltipText = `<strong>${date}</strong><br/>`;

          params.forEach((param: any) => {
            // Use param.data[1] for original value, not param.value (which is transformed for log scale)
            const originalValue = param.data ? param.data[1] : param.value;
            tooltipText += `${param.marker} ${param.seriesName}: ${formatCurrency(originalValue)}<br/>`;
          });

          return tooltipText;
        },
      },
      legend: {
        ...baseOption.legend,
        data: data.series.map(series => series.name),
        top: '5%',
        left: 'center',
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => {
            const date = new Date(value);
            return date.toLocaleDateString();
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        // scale: false,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: data.series.map((series, index) => ({
        name: series.name,
        type: 'line',
        data: series.data.map(point => [point.timestamp, point.value]),
        smooth: true,
        symbol: 'none',
        lineStyle: {
          width: 2,
        },
        itemStyle: {
          color: chartTheme.colorPalette[index % chartTheme.colorPalette.length],
        },
      })),
    };
  }, [data, chartTheme, t]);

  // Handle retry
  const handleRetry = () => {
    fetchData();
  };

  // Render chart with wrapper
  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      height={height}
      onRetry={handleRetry}
      onExport={handleExport}
      isEmpty={!data || data.series.length === 0}
      emptyState={{
        title: t('charts.noDataTitle'),
        message: t('charts.noDataMessage'),
        action: {
          label: t('charts.resetFilters'),
          onClick: () => {
            setTimePeriod('30D');
            setTokens(['SOL', 'JTO', 'BONK']);
          },
        },
      }}
      className={className}
    >
      <ReactECharts
        ref={chartRef}
        option={chartOptions}
        style={{ height: `${height}px`, width: '100%' }}
        opts={{ renderer: 'canvas' }}
        notMerge={true}
      />
    </ChartWrapper>
  );
}