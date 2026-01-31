import React, { useMemo, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchBalanceTrend } from '../../../services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '../../../util/chart-helpers';
import type { BalanceTrendResponse } from '../../../types/chart-api.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../../../types/chart-filters.types';
import styles from './BalanceChart.module.scss';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartDataSeries } from '@/types/chart-data.types';

/**
 * Props for BalanceChart component
 */
export interface BalanceChartProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period (default: 30D) */
  initialTimePeriod?: TimePeriod;
  
  /** Initial tokens filter (default: All tokens) */
  initialTokens?: string[];
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
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
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}: BalanceChartProps) {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.balanceChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, setTimePeriod, setTokens, isValid } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
      tokens: initialTokens.length > 0 ? initialTokens : undefined,
    },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo(
    () => ({
      timePeriod: filters.timePeriod,
      tokens: filters.tokens?.join(','),
      timezone,
    }),
    [filters.timePeriod, filters.tokens, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<BalanceTrendResponse, any>({
      fetcher: fetchBalanceTrend,
      query,
      autoRefresh,
      onDataLoaded,
    });

  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'balance-trend',
  });
  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!data) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;

      if (format === 'csv') {
        const csv: ChartDataSeries[] = data.series.map((series, index) => ({
          id: `series-${index}`,
          name: series.name,
          type: 'line',
          visible: true,
          data: series.data.map(point => ({
            timestamp: point.timestamp,
            value: point.value,
          })),
        }));
        exportCSV(csv, filters);
        return;
      }

      if (!instance) return;

      format === 'png'
        ? exportPNG(instance as any, filters)
        : exportSVG(instance as any, filters);
    },
    [data, filters]
  );

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
  }, [data, timezone, chartTheme, t]);

  return (
    <div className={`${styles.balanceChart} ${className || ''}`}>
      <BaseChart
        title={chartTitle}
        height={height}
        loadingState={loadingState}
        isEmpty={!data || data.series.length === 0 || data.series[0].data.length === 0}
        onRetry={() => refetch(false)}
        onExport={handleExport}
      >
        {chartOption && (
          <ReactECharts
            ref={chartRef}
            option={chartOption}
            style={{ height, width: '100%' }}
            notMerge
            lazyUpdate
          />
        )}
      </BaseChart>
    </div>
  );
}
