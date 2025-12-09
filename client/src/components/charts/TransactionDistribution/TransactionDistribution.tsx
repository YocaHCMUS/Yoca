/**
 * TransactionDistribution Component
 * 
 * Displays dual chart view showing transaction counts by date and unique tokens traded,
 * segmented by wallet, delivering activity pattern insights.
 * 
 * @module TransactionDistribution
 */

import React, { useEffect, useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { mockFetchTransactionDistribution } from '../../../services/chart/mockChartData';
import { formatDate } from '../../../util/chart-helpers';
import type { TransactionDistributionResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { TimePeriod, TransactionType } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './TransactionDistribution.module.scss';

/**
 * Props for TransactionDistribution component
 */
export interface TransactionDistributionProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels for each sub-chart */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Initial transaction type filter */
  initialTransactionType?: TransactionType;
  
  /** Display mode for transaction counts chart */
  chartMode?: 'stacked' | 'grouped';
  
  /** Wallet IDs to display (empty array = all wallets) */
  walletIds?: string[];
  
  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: TransactionDistributionResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * TransactionDistribution Component
 * 
 * User Story 7: Analyze Transaction Distribution by Type (Priority: P3)
 * 
 * Displays dual chart view with:
 * - Transaction counts by date segmented by wallet (stacked/grouped bars)
 * - Unique tokens traded per day (line chart)
 * - Color distinction for different wallets
 * - Time period and transaction type filtering
 * - Wallet selection filtering
 * - Data labels on bars/points
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <TransactionDistribution
 *   title="Transaction Activity Analysis"
 *   height={300}
 *   initialTimePeriod="30D"
 *   chartMode="stacked"
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function TransactionDistribution({
  title = 'Transaction Activity Analysis',
  height = 300,
  initialTimePeriod = '30D',
  initialTransactionType = 'all',
  chartMode = 'stacked',
  walletIds = [],
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: TransactionDistributionProps) {
  // State management
  const [data, setData] = React.useState<TransactionDistributionResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  const [selectedChartMode, setSelectedChartMode] = React.useState<'stacked' | 'grouped'>(chartMode);
  
  // Chart instance refs for export
  const transactionChartRef = useRef<ReactECharts>(null);
  const tokenChartRef = useRef<ReactECharts>(null);
  
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
      transactionType: initialTransactionType,
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch transaction distribution data from API
   */
  const fetchData = React.useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const response = await mockFetchTransactionDistribution({
        timePeriod: filters.timePeriod,
        transactionType: filters.transactionType,
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
          message: error instanceof Error ? error.message : 'Failed to load transaction distribution data',
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
   * Generate eCharts options for transaction counts chart
   */
  const transactionCountsOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Use theme color palette
    const colorPalette = chartTheme.colorPalette;
    
    // Create series for each wallet
    const series = data.transactionCounts.map((wallet, index) => ({
      name: wallet.walletName,
      type: 'bar' as const,
      stack: selectedChartMode === 'stacked' ? 'total' : undefined,
      data: wallet.data.map(point => [point.timestamp, point.value]),
      label: {
        show: wallet.data.length <= 30,
        position: selectedChartMode === 'stacked' ? 'inside' : 'top',
        formatter: (params: any) => {
          const value = params.value[1];
          return value > 0 ? value.toString() : '';
        },
        fontSize: 10,
      },
      color: colorPalette[index % colorPalette.length],
      emphasis: {
        focus: 'series',
      },
    }));
    
    return {
      ...baseOption,
      grid: {
        top: 50,
        right: 40,
        bottom: 60,
        left: 60,
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
          
          const timestamp = params[0].value[0];
          const dateStr = formatDate(new Date(timestamp), timezone);
          
          let tooltipContent = `<strong>${dateStr}</strong><br/>`;
          let total = 0;
          
          params.forEach((param: any) => {
            const count = param.value[1];
            total += count;
            const color = param.color;
            tooltipContent += `
              <div style="display: flex; align-items: center; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px; border-radius: 50%;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <strong style="margin-left: 8px;">${count}</strong>
              </div>
            `;
          });
          
          if (selectedChartMode === 'stacked') {
            tooltipContent += `<div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #ccc;"><strong>Total: ${total}</strong></div>`;
          }
          
          return tooltipContent;
        },
      },
      legend: {
        ...baseOption.legend,
        data: data.transactionCounts.map(w => w.walletName),
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
        name: 'Transaction Count',
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
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
          show: data.transactionCounts[0]?.data.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, selectedChartMode, timezone, chartTheme]);
  
  /**
   * Generate eCharts options for unique token counts chart
   */
  const uniqueTokenCountsOptions = useMemo(() => {
    if (!data) {
      return {};
    }
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    return {
      ...baseOption,
      grid: {
        top: 50,
        right: 40,
        bottom: 60,
        left: 60,
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
          const count = params[0].value[1];
          
          return `
            <strong>${dateStr}</strong><br/>
            <div style="display: flex; align-items: center; margin-top: 4px;">
              <span style="display: inline-block; width: 10px; height: 10px; background-color: ${params[0].color}; margin-right: 8px; border-radius: 50%;"></span>
              <span style="flex: 1;">Unique Tokens:</span>
              <strong style="margin-left: 8px;">${count}</strong>
            </div>
          `;
        },
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
        name: 'Unique Tokens',
        nameLocation: 'middle',
        nameGap: 45,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
        },
      },
      series: [
        {
          name: 'Unique Tokens',
          type: 'line',
          data: data.uniqueTokenCounts.map(point => [point.timestamp, point.value]),
          smooth: 0.3,
          showSymbol: data.uniqueTokenCounts.length <= 50,
          symbolSize: 6,
          itemStyle: {
            color: chartTheme.colorPalette[1], // Use theme green
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${chartTheme.colorPalette[1]}4D` }, // 30% opacity
                { offset: 1, color: `${chartTheme.colorPalette[1]}0D` }, // 5% opacity
              ],
            },
          },
          label: {
            show: data.uniqueTokenCounts.length <= 30,
            position: 'top',
            formatter: (params: any) => params.value[1].toString(),
            fontSize: 10,
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.uniqueTokenCounts.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, timezone, chartTheme]);
  
  // Export functionality
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle: title,
    timezone,
    baseFilename: 'transaction-distribution',
  });
  
  /**
   * Handle export based on format
   */
  const handleExport = async (format: ExportFormat) => {
    const transactionChartInstance = transactionChartRef.current?.getEchartsInstance();
    if (!transactionChartInstance) {
      console.error('Transaction chart instance not available for export');
      return;
    }
    
    if (format === 'png') {
      exportPNG(transactionChartInstance as any, filters);
    } else if (format === 'svg') {
      exportSVG(transactionChartInstance as any, filters);
    } else if (format === 'csv' && data) {
      // Convert data to ChartDataSeries format for CSV export
      const csvData: Array<{
        id: string;
        name: string;
        type: 'bar' | 'line';
        data: Array<{ name: string; value: number }>;
        visible: boolean;
      }> = data.transactionCounts.map(wallet => ({
        id: wallet.walletId,
        name: wallet.walletName,
        type: 'bar' as const,
        data: wallet.data.map(point => ({
          name: new Date(point.timestamp).toISOString(),
          value: point.value,
        })),
        visible: true,
      }));
      
      // Add unique token counts as a separate series
      csvData.push({
        id: 'unique-tokens',
        name: 'Unique Tokens',
        type: 'line' as const,
        data: data.uniqueTokenCounts.map(point => ({
          name: new Date(point.timestamp).toISOString(),
          value: point.value,
        })),
        visible: true,
      });
      
      exportCSV(csvData, filters);
    }
  };
  
  /**
   * Handle chart mode toggle
   */
  const handleChartModeChange = (mode: 'stacked' | 'grouped') => {
    setSelectedChartMode(mode);
  };
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    fetchData(false);
  };
  
  return (
    <ChartWrapper
      title={title}
      loadingState={loadingState}
      height={height * 2 + 40}
      onExport={handleExport}
      onRetry={handleRetry}
      isEmpty={!data || (data.transactionCounts.length === 0 && data.uniqueTokenCounts.length === 0)}
      emptyState={{
        title: 'No Transaction Data',
        message: 'No transaction distribution data available for the selected time period and filters.',
        action: {
          label: 'Reset Filters',
          onClick: () => setTimePeriod('30D'),
        },
      }}
      className={className}
    >
      <div className={styles.transactionDistribution}>
        {/* Chart mode selector */}
        <div className={styles.controls}>
          <div className={styles.chartModeToggle}>
            <button
              className={selectedChartMode === 'stacked' ? styles.active : ''}
              onClick={() => handleChartModeChange('stacked')}
              aria-label="Stacked bars"
              title="Stacked bars"
            >
              Stacked
            </button>
            <button
              className={selectedChartMode === 'grouped' ? styles.active : ''}
              onClick={() => handleChartModeChange('grouped')}
              aria-label="Grouped bars"
              title="Grouped bars"
            >
              Grouped
            </button>
          </div>
        </div>
        
        {/* Transaction counts chart */}
        {data && (
          <div className={styles.chartSection}>
            <h3 className={styles.chartTitle}>Transaction Counts by Wallet</h3>
            <ReactECharts
              ref={transactionChartRef}
              option={transactionCountsOptions}
              style={{ height: `${height}px`, width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        )}
        
        {/* Unique token counts chart */}
        {data && (
          <div className={styles.chartSection}>
            <h3 className={styles.chartTitle}>Unique Tokens Traded Per Day</h3>
            <ReactECharts
              ref={tokenChartRef}
              option={uniqueTokenCountsOptions}
              style={{ height: `${height}px`, width: '100%' }}
              opts={{ renderer: 'canvas' }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}
