/**
 * HoldingDurations Component
 * 
 * Displays bar charts showing holding duration in days for top tokens per wallet,
 * delivering holding behavior insights.
 * 
 * @module HoldingDurations
 */

import React, { useEffect, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { ChartWrapper } from '../shared/ChartWrapper';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { mockFetchHoldingDurations } from '../../../services/chart/mockChartData';
import type { HoldingDurationsResponse } from '../../../types/chart-api.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './HoldingDurations.module.scss';

/**
 * Time unit for displaying holding durations
 */
export type TimeUnit = 'days' | 'weeks' | 'months';

/**
 * Props for HoldingDurations component
 */
export interface HoldingDurationsProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels per wallet */
  height?: number;
  
  /** Wallet IDs to display (empty array = all wallets) */
  walletIds?: string[];
  
  /** Limit to top N tokens per wallet (default: 10) */
  topN?: number;
  
  /** Time unit for duration display (default: 'days') */
  timeUnit?: TimeUnit;
  
  /** Enable auto-refresh (default: true) */
  enableAutoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: HoldingDurationsResponse) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * HoldingDurations Component
 * 
 * User Story 8: View Token Holding Duration Analysis (Priority: P3)
 * 
 * Displays:
 * - Separate bar charts for each wallet
 * - Token symbols on X-axis
 * - Duration values (days/weeks/months) on Y-axis
 * - Duration labels on bars
 * - Filters for top N tokens and time unit
 * - Auto-refresh every 30 seconds
 * 
 * @example
 * ```tsx
 * <HoldingDurations
 *   title="Token Holding Durations"
 *   height={300}
 *   topN={10}
 *   timeUnit="days"
 *   enableAutoRefresh={true}
 * />
 * ```
 */
export function HoldingDurations({
  title = 'Token Holding Durations',
  height = 300,
  walletIds = [],
  topN = 10,
  timeUnit = 'days',
  enableAutoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: HoldingDurationsProps) {
  // State management
  const [data, setData] = React.useState<HoldingDurationsResponse | null>(null);
  const [loadingState, setLoadingState] = React.useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  const [selectedTimeUnit, setSelectedTimeUnit] = React.useState<TimeUnit>(timeUnit);
  const [selectedTopN, setSelectedTopN] = React.useState<number>(topN);
  
  // Chart instance refs for export (one per wallet)
  const chartRefs = useRef<Map<string, ReactECharts>>(new Map());
  
  // Get timezone from context
  const { selectedTimezone: timezone } = useChartContext();
  
  // Get theme configuration
  const chartTheme = useChartTheme();
  
  // Chart filters with debouncing
  const {
    filters,
    isValid,
  } = useChartFilters({
    initialFilters: {
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  /**
   * Fetch holding durations data from API
   */
  const fetchData = React.useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const response = await mockFetchHoldingDurations({
        walletIds: filters.wallets,
        topN: selectedTopN,
        timeUnit: selectedTimeUnit,
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
          message: error instanceof Error ? error.message : 'Failed to load holding durations data',
          retryable: true,
        },
      }));
    }
  }, [isValid, filters, selectedTopN, selectedTimeUnit, timezone, onDataLoaded]);
  
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
   * Convert duration value to selected time unit
   */
  const convertDuration = (durationInDays: number): number => {
    switch (selectedTimeUnit) {
      case 'weeks':
        return durationInDays / 7;
      case 'months':
        return durationInDays / 30;
      default:
        return durationInDays;
    }
  };
  
  /**
   * Get time unit label
   */
  const getTimeUnitLabel = (): string => {
    switch (selectedTimeUnit) {
      case 'weeks':
        return 'Weeks';
      case 'months':
        return 'Months';
      default:
        return 'Days';
    }
  };
  
  /**
   * Generate eCharts options for a single wallet's holding durations
   */
  const generateWalletChartOptions = (wallet: HoldingDurationsResponse['wallets'][0]) => {
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    const chartData = wallet.holdings.map(holding => ({
      name: holding.tokenSymbol,
      value: convertDuration(holding.durationDays),
    }));
    
    return {
      ...baseOption,
      grid: {
        top: 40,
        right: 40,
        bottom: 60,
        left: 80,
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
          
          const param = params[0];
          const originalDays = wallet.holdings.find(h => h.tokenSymbol === param.name)?.durationDays || 0;
          
          let tooltipContent = `<strong>${param.name}</strong><br/>`;
          tooltipContent += `Duration: <strong>${param.value.toFixed(1)} ${getTimeUnitLabel().toLowerCase()}</strong><br/>`;
          tooltipContent += `<span style="font-size: 0.75rem; color: #888;">(${originalDays} days)</span>`;
          
          return tooltipContent;
        },
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: chartData.map(d => d.name),
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          rotate: 45,
          fontSize: 11,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: `Duration (${getTimeUnitLabel()})`,
        nameLocation: 'middle',
        nameGap: 60,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
        },
      },
      series: [
        {
          type: 'bar',
          data: chartData.map(d => d.value),
          itemStyle: {
            color: chartTheme.colorPalette[0], // Use theme blue
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value.toFixed(1),
            fontSize: 10,
          },
          emphasis: {
            itemStyle: {
              color: chartTheme.colorPalette[0],
              shadowBlur: 10,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  };
  
  // Export functionality
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle: title,
    timezone,
    baseFilename: 'holding-durations',
  });
  
  /**
   * Handle export based on format
   */
  const handleExport = async (format: ExportFormat) => {
    if (!data || data.wallets.length === 0) return;
    
    if (format === 'csv') {
      // Convert data to ChartDataSeries format for CSV export
      const csvData = data.wallets.map(wallet => ({
        id: wallet.id,
        name: wallet.name,
        type: 'bar' as const,
        data: wallet.holdings.map(holding => ({
          name: holding.tokenSymbol,
          value: convertDuration(holding.durationDays),
        })),
        visible: true,
      }));
      exportCSV(csvData, filters);
    } else {
      // Export first wallet's chart as PNG/SVG
      const firstChartInstance = chartRefs.current.values().next().value?.getEchartsInstance();
      if (firstChartInstance) {
        if (format === 'png') {
          exportPNG(firstChartInstance as any, filters);
        } else if (format === 'svg') {
          exportSVG(firstChartInstance as any, filters);
        }
      }
    }
  };
  
  /**
   * Handle retry on error
   */
  const handleRetry = () => {
    fetchData(false);
  };
  
  /**
   * Handle time unit change
   */
  const handleTimeUnitChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTimeUnit(event.target.value as TimeUnit);
  };
  
  /**
   * Handle top N change
   */
  const handleTopNChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTopN(parseInt(event.target.value, 10));
  };
  
  return (
    <ChartWrapper
      title={title}
      loadingState={loadingState}
      height={height * (data?.wallets.length || 1)}
      onExport={handleExport}
      onRetry={handleRetry}
      isEmpty={!data || data.wallets.length === 0}
      emptyState={{
        title: 'No Holding Data',
        message: 'No token holding duration data available for the selected wallets.',
        action: {
          label: 'Refresh Data',
          onClick: handleRetry,
        },
      }}
      className={className}
    >
      <div className={styles.holdingDurations}>
        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.filterGroup}>
            <label htmlFor="timeUnit">Time Unit:</label>
            <select
              id="timeUnit"
              value={selectedTimeUnit}
              onChange={handleTimeUnitChange}
              aria-label="Select time unit"
            >
              <option value="days">Days</option>
              <option value="weeks">Weeks</option>
              <option value="months">Months</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="topN">Show Top:</label>
            <select
              id="topN"
              value={selectedTopN}
              onChange={handleTopNChange}
              aria-label="Select number of tokens to display"
            >
              <option value="5">5 tokens</option>
              <option value="10">10 tokens</option>
              <option value="15">15 tokens</option>
              <option value="20">20 tokens</option>
            </select>
          </div>
        </div>
        
        {/* Charts Grid */}
        {data && data.wallets.length > 0 && (
          <div className={styles.chartsGrid}>
            {data.wallets.map((wallet) => (
              <div key={wallet.id} className={styles.walletChart}>
                <div className={styles.walletTitle}>
                  {wallet.name}
                </div>
                
                {wallet.holdings.length > 0 ? (
                  <div className={styles.chartContainer}>
                    <ReactECharts
                      ref={(ref) => {
                        if (ref) {
                          chartRefs.current.set(wallet.id, ref);
                        }
                      }}
                      option={generateWalletChartOptions(wallet)}
                      style={{ height: `${height}px`, width: '100%' }}
                      opts={{ renderer: 'canvas' }}
                      notMerge={true}
                      lazyUpdate={true}
                    />
                  </div>
                ) : (
                  <div className={styles.emptyWallet}>
                    <div className={styles.emptyIcon}>📊</div>
                    <div className={styles.emptyMessage}>
                      No holdings found for this wallet
                    </div>
                    <div className={styles.emptyHint}>
                      This wallet may not have any current token holdings
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartWrapper>
  );
}
