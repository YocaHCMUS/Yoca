/**
 * PnLChart Component
 * 
 * Displays a dual-axis chart showing daily P&L bars with cumulative P&L line overlay,
 * delivering comprehensive profitability analysis.
 * 
 * Features:
 * - Dual-axis chart: bars (daily P&L) + line (cumulative P&L)
 * - Conditional bar coloring (green for profit, red for loss)
 * - Tooltip showing both daily and cumulative values with dates
 * - Time period filtering (7D, 30D, 60D, 90D, 1Y, All)
 * - Wallet filtering support
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/PnLChart
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useAutoRefresh } from '../../../hooks/useAutoRefresh';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchPnLChart } from '../../../services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '../../../util/chart-helpers';
import { ChartWrapper } from '../shared/ChartWrapper';
import type { PnLChartResponse } from '../../../types/chart-api.types';
import type { ChartFilters } from '../../../types/chart-filters.types';
import type { ChartLoadingState } from '../../../types/chart.types';
import type { ExportFormat } from '../shared/ExportMenu';
import styles from './PnLChart.module.scss';

export interface PnLChartProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial filters */
  initialFilters?: Partial<ChartFilters>;
  
  /** Data aggregation level */
  aggregation?: 'daily' | 'weekly' | 'monthly';
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Custom CSS class */
  className?: string;
}

/**
 * PnLChart Component
 * 
 * User Story: US5 - Monitor Profit and Loss Trends
 * Displays dual-axis chart showing daily P&L bars with cumulative P&L line overlay.
 */
export const PnLChart: React.FC<PnLChartProps> = ({
  title,
  height = 400,
  initialFilters,
  aggregation = 'daily',
  autoRefresh = true,
  className,
}) => {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.pnlChart.title');
  
  // State management
  const [data, setData] = useState<PnLChartResponse | null>(null);
  const [loadingState, setLoadingState] = useState<ChartLoadingState>({
    status: 'idle',
    retryCount: 0,
  });
  
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
    initialFilters,
    debounceDelay: 300,
  });
  
  // Reference to track if component is mounted
  const isMountedRef = useRef(true);
  
  // Chart instance ref for export
  const chartRef = useRef<ReactECharts>(null);
  
  /**
   * Fetch P&L data from API
   */
  const fetchData = useCallback(async (isRefreshing = false) => {
    if (!isValid) return;
    
    setLoadingState(prev => ({
      status: isRefreshing ? 'refreshing' : 'loading',
      retryCount: isRefreshing ? prev.retryCount : prev.retryCount + 1,
    }));
    
    try {
      const result = await fetchPnLChart({
        period: filters.timePeriod,
        wallets: filters.wallets?.join(','),
        aggregation,
      });
      
      if (!isMountedRef.current) return;
      
      setData(result);
      setLoadingState({ status: 'success', retryCount: 0 });
    } catch (error) {
      if (!isMountedRef.current) return;
      
      setLoadingState(prev => ({
        status: 'error',
        retryCount: prev.retryCount,
        error: {
          code: 'FETCH_ERROR',
          message: error instanceof Error ? error.message : 'Failed to load P&L data',
          retryable: true,
        },
      }));
    }
  }, [filters, isValid, aggregation]);
  
  // Auto-refresh with pause detection
  useAutoRefresh({
    onRefresh: () => fetchData(true),
    config: {
      enabled: true,
      interval: 30000,
      pauseOnInteraction: true,
    },
    enabled: autoRefresh && loadingState.status === 'success',
  });
  
  // Initial data fetch
  useEffect(() => {
    fetchData();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchData]);
  
  // Update data when filters change
  useEffect(() => {
    if (loadingState.status !== 'idle') {
      fetchData();
    }
  }, [filters, aggregation, timezone]);
  
  /**
   * Generate eCharts option configuration
   */
  const chartOption: EChartsOption | null = useMemo(() => {
    if (!data || data.dailyPnL.length === 0) {
      return null;
    }
    
    // Use theme colors
    const profitColor = chartTheme.colorPalette[1]; // Green
    const lossColor = chartTheme.colorPalette[2]; // Red
    const cumulativeColor = chartTheme.colorPalette[0]; // Blue
    
    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);
    
    // Extract timestamps and values
    const timestamps = data.dailyPnL.map((item: { timestamp: number; value: number }) => item.timestamp);
    const dailyValues = data.dailyPnL.map((item: { timestamp: number; value: number }) => item.value);
    const cumulativeValues = data.cumulativePnL.map((item: { timestamp: number; value: number }) => item.value);
    
    // Format X-axis dates
    const xAxisData = timestamps.map((ts: number) => formatTimestampWithTimezone(ts, timezone, 'MM/dd'));
    
    return {
      ...baseOption,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: chartTheme.textColorSecondary,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';
          
          const timestamp = timestamps[params[0].dataIndex];
          const date = formatTimestampWithTimezone(timestamp, timezone, 'PPP');
          const dailyValue = dailyValues[params[0].dataIndex];
          const cumulativeValue = cumulativeValues[params[0].dataIndex];
          
          return `
            <strong>${date}</strong><br/>
            ${t('charts.pnlChart.dailyPnL')}: <span style="color: ${dailyValue >= 0 ? profitColor : lossColor}">${formatCurrency(dailyValue)}</span><br/>
            ${t('charts.pnlChart.cumulativePnL')}: ${formatCurrency(cumulativeValue)}
          `;
        },
      },
      legend: {
        ...baseOption.legend,
        data: [t('charts.pnlChart.dailyPnL'), t('charts.pnlChart.cumulativePnL')],
        top: 0,
      },
      xAxis: [
        {
          ...baseOption.xAxis,
          type: 'category',
          data: xAxisData,
          axisPointer: {
            type: 'shadow',
          },
        },
      ],
      yAxis: [
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.pnlChart.dailyPnL'),
          position: 'left',
          axisLine: {
            ...baseOption.yAxis.axisLine,
            show: true,
          },
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => {
              // Format with K/M suffix for large numbers
              if (Math.abs(value) >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (Math.abs(value) >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`;
              }
              return formatCurrency(value);
            },
          },
          splitLine: {
            ...baseOption.yAxis.splitLine,
            lineStyle: {
              ...baseOption.yAxis.splitLine?.lineStyle,
              opacity: 0.2,
            },
          },
        },
        {
          ...baseOption.yAxis,
          type: 'value',
          name: t('charts.pnlChart.cumulativePnL'),
          position: 'right',
          axisLine: {
            ...baseOption.yAxis.axisLine,
            show: true,
          },
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => {
              // Format with K/M suffix for large numbers
              if (Math.abs(value) >= 1000000) {
                return `$${(value / 1000000).toFixed(1)}M`;
              } else if (Math.abs(value) >= 1000) {
                return `$${(value / 1000).toFixed(1)}K`;
              }
              return formatCurrency(value);
            },
          },
          splitLine: {
            show: false,
          },
        },
      ],
      series: [
        {
          name: t('charts.pnlChart.dailyPnL'),
          type: 'bar',
          data: dailyValues,
          itemStyle: {
            color: (params: any) => {
              return params.value >= 0 ? profitColor : lossColor;
            },
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
        {
          name: t('charts.pnlChart.cumulativePnL'),
          type: 'line',
          yAxisIndex: 1,
          data: cumulativeValues,
          smooth: true,
          lineStyle: {
            color: cumulativeColor,
            width: 2,
          },
          itemStyle: {
            color: cumulativeColor,
          },
          symbol: 'circle',
          symbolSize: 6,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    };
  }, [data, timezone, chartTheme, t]);
  
  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'pnl-chart',
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
          id: 'daily-pnl',
          name: t('charts.pnlChart.dailyPnL'),
          type: 'bar' as const,
          data: data.dailyPnL.map((item: { timestamp: number; value: number }) => ({
            timestamp: item.timestamp,
            value: item.value,
          })),
          visible: true,
        },
        {
          id: 'cumulative-pnl',
          name: t('charts.pnlChart.cumulativePnL'),
          type: 'line' as const,
          data: data.cumulativePnL.map((item: { timestamp: number; value: number }) => ({
            timestamp: item.timestamp,
            value: item.value,
          })),
          visible: true,
        },
      ];
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
    <div className={`${styles.pnlChart} ${className || ''}`}>
      <ChartWrapper
        title={chartTitle}
        loadingState={loadingState}
        height={height}
        onRetry={handleRetry}
        onExport={handleExport}
        isEmpty={!data || data.dailyPnL.length === 0}
        emptyState={{
          title: t('charts.noDataTitle'),
          message: t('charts.noDataMessage'),
          action: {
            label: t('charts.resetFilters'),
            onClick: () => {
              setTimePeriod('30D');
              setWallets(undefined);
            },
          },
        }}
      >
        {renderChart()}
      </ChartWrapper>
    </div>
  );
};

export default PnLChart;
