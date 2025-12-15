/**
 * VolumeBenchmark Component
 * 
 * Displays multi-series line or bar chart with benchmark comparisons and value annotations,
 * allowing users to quickly spot performance differences across wallets.
 * 
 * @module VolumeBenchmark
 */

import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { mockFetchVolumeBenchmark } from '../../../services/chart/mockChartData';
import { formatCurrency, formatDate } from '../../../util/chart-helpers';
import type { VolumeBenchmarkResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './VolumeBenchmark.module.scss';

/**
 * Props for VolumeBenchmark component
 */
export interface VolumeBenchmarkProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Display as line or bar chart */
  chartType?: 'line' | 'bar';
  
  /** Show data labels on points/bars */
  showDataLabels?: boolean;
  
  /** Wallet IDs to compare (empty array = all wallets) */
  walletIds?: string[];
  
  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: VolumeBenchmarkResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * VolumeBenchmark Component
 * 
 * User Story 6: Compare Trading Volume Across Benchmarks (Priority: P3)
 * 
 * Displays multi-series chart with:
 * - Multiple colored lines/bars for different wallets
 * - Value annotations on hover
 * - Dates clearly marked on X-axis
 * - Legend identifies each wallet
 * - Time period filtering
 * - Wallet selection filtering
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <VolumeBenchmark
 *   title="Trading Volume Comparison"
 *   height={400}
 *   initialTimePeriod="30D"
 *   chartType="line"
 *   showDataLabels={false}
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function VolumeBenchmark({
  title,
  height = 400,
  initialTimePeriod = '30D',
  chartType = 'line',
  showDataLabels = false,
  walletIds = [],
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: VolumeBenchmarkProps) {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.volumeBenchmarkChart.title');
  
  // State management
  const [data, setData] = React.useState<VolumeBenchmarkResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  const [selectedChartType, setSelectedChartType] = React.useState<'line' | 'bar'>(chartType);
  
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
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch volume benchmark data from API
   */
  const fetchData = React.useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const response = await mockFetchVolumeBenchmark({
        timePeriod: filters.timePeriod,
        walletIds: filters.wallets,
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
          message: error instanceof Error ? error.message : 'Failed to load volume benchmark data',
          retryable: true,
        },
      }));
    }
  }, [isValid, filters, timezone, onDataLoaded]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // Fetch data on filter changes
  useEffect(() => {
    fetchData(false);
  }, [fetchData]);
  
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
  
  /**
   * Generate eCharts options for volume benchmark visualization
   */
  const chartOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Use theme color palette
    const colorPalette = chartTheme.colorPalette;
    
    // Create series for each wallet
    const series = data.wallets.map((wallet, index) => ({
      name: wallet.name,
      type: selectedChartType as 'line' | 'bar',
      data: wallet.dataPoints.map(point => [point.timestamp, point.volume]),
      smooth: selectedChartType === 'line' ? 0.3 : undefined,
      showSymbol: selectedChartType === 'line' ? data.wallets[0]?.dataPoints.length <= 50 : undefined,
      symbolSize: 6,
      label: showDataLabels ? {
        show: true,
        position: selectedChartType === 'line' ? 'top' : 'insideTop',
        formatter: (params: any) => formatCurrency(params.value[1]),
        fontSize: 10,
      } : undefined,
      color: colorPalette[index % colorPalette.length],
      emphasis: {
        focus: 'series',
      },
    }));
    
    return {
      ...baseOption,
      grid: {
        top: 60,
        right: 40,
        bottom: 60,
        left: 80,
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999',
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = params[0].value[0];
          const dateStr = formatDate(new Date(timestamp), timezone);
          
          let tooltipContent = `<strong>${dateStr}</strong><br/>`;
          params.forEach((param: any) => {
            const volume = param.value[1];
            const color = param.color;
            tooltipContent += `
              <div style="display: flex; align-items: center; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px; border-radius: 50%;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <strong style="margin-left: 8px;">${formatCurrency(volume)}</strong>
              </div>
            `;
          });
          
          return tooltipContent;
        },
      },
      legend: {
        ...baseOption.legend,
        data: data.wallets.map(w => w.name),
        top: 10,
        type: 'scroll',
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatDate(new Date(value), timezone, 'MMM dd'),
          rotate: 45,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: t('charts.volumeBenchmarkChart.volume'),
        nameLocation: 'middle',
        nameGap: 60,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => formatCurrency(value),
        },
      },
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.wallets[0]?.dataPoints.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, selectedChartType, showDataLabels, timezone, chartTheme]);
  
  // Export functionality
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'volume-benchmark',
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
      const csvData = data.wallets.map(wallet => ({
        id: wallet.id,
        name: wallet.name,
        type: 'line' as const,
        data: wallet.dataPoints.map(point => ({
          name: new Date(point.timestamp).toISOString(),
          value: point.volume,
        })),
        visible: true,
      }));
      exportCSV(csvData, filters);
    }
  };
  
  /**
   * Handle chart type toggle
   */
  const handleChartTypeChange = (type: 'line' | 'bar') => {
    setSelectedChartType(type);
  };
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    fetchData(false);
  };
  
  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      height={height}
      onExport={handleExport}
      onRetry={handleRetry}
      isEmpty={!data || data.wallets.length === 0}
      emptyState={{
        title: t('charts.noDataTitle'),
        message: t('charts.noDataMessage'),
        action: {
          label: t('charts.resetFilters'),
          onClick: () => setTimePeriod('30D'),
        },
      }}
      className={className}
    >
      <div className={styles.volumeBenchmark}>
        {/* Chart type selector */}
        <div className={styles.controls}>
          <div className={styles.chartTypeToggle}>
            <button
              className={selectedChartType === 'line' ? styles.active : ''}
              onClick={() => handleChartTypeChange('line')}
              aria-label={t('charts.volumeBenchmarkChart.line')}
              title={t('charts.volumeBenchmarkChart.line')}
            >
              {t('charts.volumeBenchmarkChart.line')}
            </button>
            <button
              className={selectedChartType === 'bar' ? styles.active : ''}
              onClick={() => handleChartTypeChange('bar')}
              aria-label={t('charts.volumeBenchmarkChart.bar')}
              title={t('charts.volumeBenchmarkChart.bar')}
            >
              {t('charts.volumeBenchmarkChart.bar')}
            </button>
          </div>
        </div>
        
        {/* Chart */}
        {data && (
          <ReactECharts
            ref={chartRef}
            option={chartOptions}
            style={{ height: `${height}px`, width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        )}
      </div>
    </ChartWrapper>
  );
}
