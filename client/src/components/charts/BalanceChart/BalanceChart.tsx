/**
 * BalanceChart Component
 * 
 * Displays line/area chart showing balance history over selectable time periods
 * to deliver immediate portfolio performance visibility.
 * 
 * @module BalanceChart
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
// import { fetchBalanceTrend } from '../../../services/chart/chartApi';
import { mockFetchBalanceTrend } from '../../../services/chart/mockChartData';
import { formatCurrency, formatTimestampWithTimezone } from '../../../util/chart-helpers';
import type { BalanceTrendResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './BalanceChart.module.scss';

/**
 * Props for BalanceChart component
 */
interface BalanceChartProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Initial tokens filter (default: All tokens) */
  initialTokens?: string[];
  
  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: BalanceTrendResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * BalanceChart Component
 * 
 * User Story 1: View Crypto Balance Trends (Priority: P1) 🎯 MVP
 * 
 * Displays line/area chart showing balance history with:
 * - Time period filters (7D, 30D, 60D, 90D, 1Y, All)
 * - Token filtering (All tokens or specific selection)
 * - Hover tooltips with timezone-aware timestamps
 * - Auto-refresh every 30 seconds (pause-aware)
 * - LTTB sampling for large datasets (>2000 points)
 * 
 * @example
 * ```tsx
 * <BalanceChart
 *   title="Portfolio Balance Trend"
 *   height={400}
 *   initialTimePeriod="30D"
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function BalanceChart({
  title,
  height = 400,
  initialTimePeriod = '30D',
  initialTokens = [],
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: BalanceChartProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.balanceChart.title');
  
  // State management
  const [data, setData] = React.useState<BalanceTrendResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  
  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);
  
  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Chart filters with debouncing
  const {
    filters,
    setTimePeriod,
    setTokens,
    isValid,
  } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
      tokens: initialTokens.length > 0 ? initialTokens : undefined,
    },
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch balance trend data from API
   */
  const fetchData = React.useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const response = await mockFetchBalanceTrend({
        timePeriod: filters.timePeriod,
        tokens: filters.tokens?.join(','),
        timezone,
      });
      
      if (!isMountedRef.current) return;
      
      setData(response);
      setLoadingState({ status: 'success', retryCount: 0 });
      onDataLoaded?.(response);
    } catch (error) {
      if (!isMountedRef.current) return;
      
      setLoadingState(prev => ({
        status: 'error',
        retryCount: prev.retryCount,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load balance data',
          retryable: true,
        },
      }));
    }
  }, [filters, timezone, isValid, onDataLoaded]);
  
  // Auto-refresh with pause detection
  useAutoRefresh({
    onRefresh: () => fetchData(true),
    config: {
      enabled: true,
      interval: refreshInterval,
      pauseOnInteraction: true,
    },
    enabled: enableAutoRefresh && loadingState.status === 'success',
  });
  
  // Fetch data when filters change
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  /**
   * Generate eCharts option configuration
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data || data.series.length === 0 || data.series[0].data.length === 0) return null;
    
    // Extract timestamps and values from first series (or combined total)
    const seriesData = data.series[0].data;
    const timestamps = seriesData.map((point: any) => point.timestamp);
    const values = seriesData.map((point: any) => point.value);
    
    // Determine if LTTB sampling is needed (>2000 points)
    const enableSampling = seriesData.length > 2000;
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        boundaryGap: false as any,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => {
            return formatTimestampWithTimezone(value, timezone, 'MMM dd');
          },
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series: [
        {
          name: t('charts.balanceChart.balance'),
          type: 'line',
          smooth: true,
          sampling: enableSampling ? 'lttb' : undefined,
          data: timestamps.map((timestamp: number, index: number) => [timestamp, values[index]]),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
          lineStyle: {
            color: '#1890ff',
            width: 2,
          },
          itemStyle: {
            color: '#1890ff',
          },
        },
      ],
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const param = params[0];
          const timestamp = param.value[0];
          const value = param.value[1];
          
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${formatTimestampWithTimezone(timestamp, timezone, 'PPpp')}
            </div>
            <div>
              ${t('charts.balanceChart.balance')}: <strong>${formatCurrency(value)}</strong>
            </div>
          `;
        },
      },
    };
  }, [data, timezone, chartTheme]);
  
  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'balance-trend',
  });
  
  /**
   * Handle export based on format
   */
  const handleExport = async (format: ExportFormat) => {
    const chartInstance = chartRef.current?.getEchartsInstance();
    if (!chartInstance) {
      console.error('Chart instance not available for export');
      return;
    }
    
    if (format === 'png') {
      exportPNG(chartInstance as any, filters);
    } else if (format === 'svg') {
      exportSVG(chartInstance as any, filters);
    } else if (format === 'csv' && data) {
      // Convert data to ChartDataSeries format for CSV export
      const csvData = data.series.map((series, index) => ({
        id: `series-${index}`,
        name: series.name,
        type: 'line' as const,
        data: series.data.map(point => ({
          timestamp: point.timestamp,
          value: point.value,
        })),
        visible: true,
      }));
      exportCSV(csvData, filters);
    }
  };
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    fetchData();
  };
  
  /**
   * Render chart content
   */
  const renderChart = () => {
    if (!chartOption) return null;
    
    return (
      <ReactECharts
        ref={chartRef}
        option={chartOption}
        style={{ height: `${height}px`, width: '100%' }}
        notMerge={true}
        lazyUpdate={true}
        opts={{ renderer: 'canvas' }}
      />
    );
  };
  
  return (
    <div className={`${styles.balanceChart} ${className || ''}`}>
      <ChartWrapper
        title={chartTitle}
        loadingState={loadingState}
        height={height}
        onRetry={handleRetry}
        onExport={handleExport}
        isEmpty={!data || data.series.length === 0 || data.series[0].data.length === 0}
        emptyState={{
          title: t('charts.noDataTitle'),
          message: t('charts.noDataMessage'),
          action: {
            label: t('charts.resetFilters'),
            onClick: () => {
              setTimePeriod('30D');
              setTokens([]);
            },
          },
        }}
      >
        {renderChart()}
      </ChartWrapper>
    </div>
  );
}

export default BalanceChart;
