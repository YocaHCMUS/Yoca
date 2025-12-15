/**
 * ExchangeComparison Component
 * 
 * Displays grouped bar chart comparing deposits vs withdrawals across exchanges,
 * delivering immediate insight into exchange-specific activity patterns.
 * 
 * @module ExchangeComparison
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
import { mockFetchExchangeComparison } from '../../../services/chart/mockChartData';
import { formatCurrency } from '../../../util/chart-helpers';
import type { ExchangeComparisonResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';

/**
 * Props for ExchangeComparison component
 */
interface ExchangeComparisonProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Metric to display: count (transaction count) or volume (USD value) */
  metric?: 'count' | 'volume';
  
  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: ExchangeComparisonResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * ExchangeComparison Component
 * 
 * User Story 3: Compare Exchange Trading Activity (Priority: P2)
 * 
 * Displays grouped bar chart with:
 * - Exchange names on X-axis
 * - Deposits vs withdrawals as grouped bars
 * - Data labels on top of each bar
 * - Time period filtering
 * - Metric selector (count vs volume)
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <ExchangeComparison
 *   title="Exchange Activity Comparison"
 *   height={400}
 *   initialTimePeriod="30D"
 *   metric="count"
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function ExchangeComparison({
  title,
  height = 400,
  initialTimePeriod = '30D',
  metric = 'count',
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: ExchangeComparisonProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.exchangeComparisonChart.title');
  
  // State management
  const [data, setData] = React.useState<ExchangeComparisonResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  const [currentMetric, setCurrentMetric] = React.useState<'count' | 'volume'>(metric);
  
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
    isValid,
  } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
    },
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch exchange comparison data from API
   */
  const fetchData = React.useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const response = await mockFetchExchangeComparison({
        timePeriod: filters.timePeriod,
        metric: currentMetric,
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
          message: error instanceof Error ? error.message : 'Failed to load exchange data',
          retryable: true,
        },
      }));
    }
  }, [filters, currentMetric, timezone, isValid, onDataLoaded]);
  
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
   * Generate eCharts option configuration for grouped bar chart
   */
  const chartOption = useMemo((): EChartsOption | null => {
    if (!data || data.exchanges.length === 0) return null;
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract exchange names and values
    const exchangeNames = data.exchanges.map(ex => ex.name);
    const deposits = data.exchanges.map(ex => 
      currentMetric === 'count' ? ex.deposits : ex.depositsVolume
    );
    const withdrawals = data.exchanges.map(ex => 
      currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume
    );
    
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const exchangeName = params[0].axisValue;
          let tooltipContent = `<strong>${exchangeName}</strong><br/>`;
          
          params.forEach((param: any) => {
            const value = currentMetric === 'count' 
              ? `${param.value.toLocaleString()} txns`
              : formatCurrency(param.value);
            tooltipContent += `${param.marker} ${param.seriesName}: ${value}<br/>`;
          });
          
          return tooltipContent;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.exchangeComparisonChart.deposits'), t('charts.exchangeComparisonChart.withdrawals')],
        top: '5%',
        left: 'center',
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: exchangeNames,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 30,
          interval: 0,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: currentMetric === 'count' ? t('charts.exchangeComparisonChart.count') : t('charts.exchangeComparisonChart.volume'),
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => {
            if (currentMetric === 'count') {
              return value.toLocaleString();
            }
            return formatCurrency(value);
          },
        },
      },
      series: [
        {
          name: t('charts.exchangeComparisonChart.deposits'),
          type: 'bar',
          data: deposits,
          itemStyle: {
            color: '#10b981', // Green for deposits
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              if (currentMetric === 'count') {
                return params.value >= 1000 
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return formatCurrency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
        {
          name: t('charts.exchangeComparisonChart.withdrawals'),
          type: 'bar',
          data: withdrawals,
          itemStyle: {
            color: '#ef4444', // Red for withdrawals
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => {
              if (currentMetric === 'count') {
                return params.value >= 1000 
                  ? `${(params.value / 1000).toFixed(1)}k`
                  : params.value.toString();
              }
              return formatCurrency(params.value);
            },
            fontSize: 11,
          },
          barMaxWidth: 50,
        },
      ],
    };
  }, [data, currentMetric, chartTheme, t]);
  
  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'exchange-comparison',
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
      const csvData = [
        {
          id: 'deposits',
          name: t('charts.exchangeComparisonChart.deposits'),
          type: 'bar' as const,
          data: data.exchanges.map(ex => ({
            name: ex.name,
            value: currentMetric === 'count' ? ex.deposits : ex.depositsVolume,
          })),
          visible: true,
        },
        {
          id: 'withdrawals',
          name: t('charts.exchangeComparisonChart.withdrawals'),
          type: 'bar' as const,
          data: data.exchanges.map(ex => ({
            name: ex.name,
            value: currentMetric === 'count' ? ex.withdrawals : ex.withdrawalsVolume,
          })),
          visible: true,
        },
      ];
      exportCSV(csvData, filters);
    }
  };
  
  /**
   * Handle retry after error
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
        opts={{ renderer: 'canvas' }}
        notMerge={true}
        lazyUpdate={true}
      />
    );
  };
  
  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      height={height}
      onRetry={handleRetry}
      onExport={handleExport}
      isEmpty={!data || data.exchanges.length === 0}
      emptyState={{
        title: t('charts.noDataTitle'),
        message: t('charts.noDataMessage'),
        action: {
          label: t('charts.resetFilters'),
          onClick: () => {
            setTimePeriod('30D');
            setCurrentMetric('count');
          },
        },
      }}
      className={className}
    >
      {renderChart()}
    </ChartWrapper>
  );
}
