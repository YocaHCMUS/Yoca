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

import React, { useMemo, useRef, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '../../../hooks/useChartFilters';
import { useChartExport } from '../../../hooks/useChartExport';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchPnLChart } from '../../../services/chart/chartApi';
import { formatCurrency, formatTimestampWithTimezone } from '../../../util/chart-helpers';
import type { PnLChartResponse, PnLRequestParams } from '../../../types/chart-api.types';
import type { TimePeriod } from '../../../types/chart-filters.types';
import type { ExportFormat } from '../../../types/chart-filters.types';
import styles from './PnLChart.module.scss';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import type { ChartDataSeries } from '@/types/chart-data.types';

export interface PnLChartProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Initial time period */
  initialTimePeriod?: TimePeriod;
  
  /** Initial wallets */
  initialWallets?: string[];
  
  /** Data aggregation level */
  aggregation?: 'daily' | 'weekly' | 'monthly';
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
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
  initialTimePeriod = '30D',
  initialWallets = [],
  aggregation = 'daily',
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}) => {
  const { t } = useTranslation();
  const chartTitle = title || t('charts.pnlChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const { filters, setTimePeriod, setWallets, isValid } = useChartFilters({
    initialFilters: {
      timePeriod: initialTimePeriod,
      wallets: initialWallets.length > 0 ? initialWallets : undefined,
    },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<PnLRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      wallets: filters.wallets?.join(','),
      aggregation,
      timezone,
    }),
    [filters.timePeriod, filters.wallets, aggregation, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<PnLChartResponse, PnLRequestParams>({
      fetcher: fetchPnLChart,
      query,
      autoRefresh,
      refreshInterval,
    });

  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'pnl-chart',
  // });
  // const handleExport = useCallback(
  //   (format: ExportFormat) => {
  //     if (!data) return;


  //     const instance = chartRef.current?.getEchartsInstance() ?? null;

  //     if (format === 'csv') {
  //       const csv: ChartDataSeries[] = [
  //         {
  //           id: 'daily-pnl',
  //           name: 'Daily P&L',
  //           type: 'bar',
  //           visible: true,
  //           data: data.dailyPnL.map(d => ({
  //             name: String(d.timestamp),
  //             value: d.value,
  //           })),
  //         },
  //         {
  //           id: 'cumulative-pnl',
  //           name: 'Cumulative P&L',
  //           type: 'line',
  //           visible: true,
  //           data: data.cumulativePnL.map(d => ({
  //             name: String(d.timestamp),
  //             value: d.value,
  //           })),
  //         },
  //       ];
  //       exportCSV(csv, filters);
  //       return;
  //     }

  //     if (!instance) return;

  //     format === 'png'
  //       ? exportPNG(instance as any, filters)
  //       : exportSVG(instance as any, filters);
  //   },
  //   [data, filters]
  // );

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

  return (
    <div className={`${styles.pnlChart} ${className || ''}`}>
      <BaseChart
        title={chartTitle}
        height={height}
        loadingState={loadingState}
        isEmpty={!data || data.dailyPnL.length === 0}
        onRetry={() => refetch(false)}
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
};
