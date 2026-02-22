/**
 * TokenPriceChart Component
 *
 * Displays price history line chart for a token using real API data.
 * Supports price, market cap, and volume visualization.
 *
 * @module TokenPriceChart
 */

import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartTheme, getThemedChartBaseOption } from '../../../hooks/useChartTheme';
import { ChartGridItem } from '../shared';
import { formatCurrency } from '../../../util/chart-helpers';
import { createTooltipHeader, createTooltipRow, createSeriesIndicator } from '@/util/tooltip-helpers';
import styles from './TokenPriceChart.module.scss';

/**
 * Data point structure from the API
 */
export interface TokenPriceDataPoint {
  address: string | null;
  marketCap: number;
  unixTimestampMs: number;
  price: number;
  totalVolume: number;
}

/**
 * Props for TokenPriceChart component
 */
interface TokenPriceChartProps {
  /** Chart data from API */
  data: TokenPriceDataPoint[];

  /** Chart title */
  title?: string;

  /** Chart minimum height in pixels */
  minHeight?: number;

  /** Which metric to display: 'price' | 'marketCap' | 'volume' */
  metric?: 'price' | 'marketCap' | 'volume';

  /** Show area fill under the line */
  showArea?: boolean;

  /** Additional CSS class */
  className?: string;
}

/**
 * TokenPriceChart Component
 *
 * Renders price history using real API data.
 *
 * @example
 * ```tsx
 * <TokenPriceChart
 *   data={chartData}
 *   title="SOL Price History"
 *   minHeight={400}
 *   metric="price"
 * />
 * ```
 */
export function TokenPriceChart({
  data,
  title,
  minHeight = 400,
  metric = 'price',
  showArea = true,
  className,
}: TokenPriceChartProps) {
  const { t } = useTranslation();
  const chartTheme = useChartTheme();

  // Default title based on metric
  const chartTitle = title || t(`charts.tokenPriceChart.${metric}`, {
    defaultValue: metric === 'price' ? 'Price History' : metric === 'marketCap' ? 'Market Cap' : 'Volume',
  });

  // Generate chart options
  const chartOptions: EChartsOption = useMemo(() => {
    if (!data || data.length === 0) {
      return {};
    }

    // Sort data by timestamp
    const sortedData = [...data].sort((a, b) => a.unixTimestampMs - b.unixTimestampMs);

    // Get base theme configuration
    const baseOption = getThemedChartBaseOption(chartTheme);

    // Prepare series data based on metric
    const seriesData = sortedData.map(point => {
      const value = metric === 'price' 
        ? point.price 
        : metric === 'marketCap' 
          ? point.marketCap 
          : point.totalVolume;
      return [point.unixTimestampMs, value];
    });

    // Get the primary color
    const primaryColor = chartTheme.colorPalette[0];

    return {
      ...baseOption,
      grid: {
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
        containLabel: true,
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          label: {
            backgroundColor: chartTheme.tooltipBgColor,
          },
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';

          const point = params[0];
          const date = new Date(point.axisValue);
          const dateStr = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });

          const value = point.data[1];
          const formattedValue = formatCurrency(value);

          return createTooltipHeader(dateStr)
            + createTooltipRow(
                chartTitle,
                formattedValue,
                { color: point.color, showIndicator: true }
              );
        },
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        boundaryGap: false,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => {
            const date = new Date(value);
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
        splitNumber: 5,
      },
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
          borderColor: chartTheme.borderColor,
          fillerColor: `${primaryColor}20`,
          handleStyle: {
            color: primaryColor,
          },
          textStyle: {
            color: chartTheme.textColorSecondary,
          },
        },
      ],
      series: [
        {
          name: chartTitle,
          type: 'line',
          data: seriesData,
          smooth: true,
          symbol: 'none',
          sampling: 'lttb',
          lineStyle: {
            width: 2,
            color: primaryColor,
          },
          itemStyle: {
            color: primaryColor,
          },
          areaStyle: showArea
            ? {
                color: {
                  type: 'linear',
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: `${primaryColor}40` },
                    { offset: 1, color: `${primaryColor}05` },
                  ],
                },
              }
            : undefined,
        },
      ],
    };
  }, [data, chartTheme, metric, chartTitle, showArea]);

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className={`${styles.container} ${className || ''}`} style={{ minHeight: `${minHeight}px` }}>
        <div className={styles.emptyState}>
          <p>{t('charts.noData', 'No data available')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <ChartGridItem minHeight={minHeight}>
        <ReactECharts
          option={chartOptions}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          opts={{ renderer: 'canvas' }}
          notMerge={true}
        />
      </ChartGridItem>
    </div>
  );
}

