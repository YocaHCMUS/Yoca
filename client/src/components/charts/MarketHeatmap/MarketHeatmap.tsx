/**
 * MarketHeatmap Component
 * 
 * Displays a treemap visualization of cryptocurrency market data showing asset distribution
 * by market cap with dynamic coloring based on 24h price changes.
 * 
 * Features:
 * - Treemap visualization of market cap distribution
 * - Color coding by 24h price change (green for gain, red for loss)
 * - Interactive tooltips with price, change, volume info
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/MarketHeatmap
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { BaseChart } from '@/components/charts/Base/BaseChart';
import { useChartExport } from '@/hooks/useChartExport';
import { useChartTheme } from '@/hooks/useChartTheme';
import {
  fetchRealHeatmapData,
  getChangeColor,
  formatLargeNumber,
  formatPrice,
  type HeatmapCell,
} from '@/services/market/mockMarketData';
import type { ExportFormat } from '@/components/charts/shared/ExportMenu';
import { useStandardChartController } from '@/hooks/useChartController';
import styles from './MarketHeatmap.module.scss';

/**
 * Props for MarketHeatmap component
 */
export interface MarketHeatmapProps {
  /** Chart title */
  title?: string;
  
  /** Chart height in pixels */
  height?: number;
  
  /** Enable auto-refresh (default: true) */
  autoRefresh?: boolean;
  
  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;
  
  /** Callback when data is loaded */
  onDataLoaded?: (data: HeatmapCell[]) => void;
  
  /** Additional CSS class */
  className?: string;
}

/**
 * Query interface for MarketHeatmap API
 */
export interface MarketHeatmapQuery {}

/**
 * MarketHeatmap Component
 * 
 * Displays market sentiment visualization through treemap showing asset distribution
 * by market cap with color-coded performance indicators.
 * 
 * @example
 * ```tsx
 * <MarketHeatmap
 *   title="Market Heatmap"
 *   height={400}
 *   autoRefresh={true}
 * />
 * ```
 */
export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({
  title,
  height = 400,
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
  className,
}) => {
  // i18n
  const { t } = useTranslation();
  const chartTitle = title || t('charts.marketHeatmap.title', 'Market Heatmap');
  
  // Chart instance ref for export
  const chartRef = useRef<any>(null);

  // Get theme configuration
  const chartTheme = useChartTheme();

  // // Export functionality
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone: 'UTC',
  //   baseFilename: 'market-heatmap',
  // });

  // Use standard chart controller
  const { data, loadingState, refetch } = useStandardChartController<HeatmapCell[], MarketHeatmapQuery>({
    fetcher: fetchRealHeatmapData,
    query: {},
    autoRefresh,
    refreshInterval,
    onDataLoaded,
  });

  const chartOption = useMemo(() => {
    if (!data || data.length === 0) return {};

    const treemapData = data.map((item) => ({
      name: item.symbol,
      value: item.value,
      itemStyle: {
        color: getChangeColor(item.change),
      },
      customData: {
        fullName: item.name,
        price: item.price,
        change: item.change,
        volume: item.volume,
      },
    }));

    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: '#161616',
        borderColor: '#393939',
        textStyle: {
          color: '#ffffff',
        },
        formatter: (params: any) => {
          const { data } = params;
          const { customData } = data;
          const changeColor = customData.change >= 0 ? '#66cdaa' : '#e57373';
          
          return `
            <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px;">
              ${customData.fullName} (${data.name})
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Price:</span>
              <span style="font-weight: 600">${formatPrice(customData.price)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">24h Change:</span>
              <span style="color: ${changeColor}; font-weight: 600">
                ${customData.change > 0 ? '+' : ''}${customData.change.toFixed(2)}%
              </span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Market Cap:</span>
              <span>${formatLargeNumber(data.value)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px; font-size: 12px;">
              <span style="color: #c6c6c6">Volume:</span>
              <span>${formatLargeNumber(customData.volume)}</span>
            </div>
          `;
        },
      },
      series: [
        {
          type: 'treemap',
          width: '100%',
          height: '100%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            color: '#ffffff',
            fontWeight: 'bold',
            fontSize: 14,
            formatter: (params: any) => {
              const { name, customData } = params.data;
              return `{symbol|${name}}\n{change|${customData.change > 0 ? '+' : ''}${customData.change.toFixed(2)}%}`;
            },
            rich: {
              symbol: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff',
                align: 'center',
                padding: [0, 0, 4, 0],
              },
              change: {
                fontSize: 11,
                color: '#ffffff',
                align: 'center',
                opacity: 0.9,
              },
            },
          },
          itemStyle: {
            borderColor: '#f3f4f6',
            borderWidth: 1,
            gapWidth: 1,
          },
          data: treemapData,
        },
      ],
    };
  }, [data]);

  // Export handler
  // const handleExport = useCallback(
  //   async (format: ExportFormat) => {
  //     if (!chartRef.current || !data || data.length === 0) return;

  //     try {
  //       const dataUrl = chartRef.current.getEchartsInstance().getDataURL({
  //         type: format === 'png' ? 'png' : 'svg',
  //         pixelRatio: 2,
  //         backgroundColor: '#fff',
  //       });

  //       if (format === 'csv') {
  //         // CSV export
  //         const csvContent = [
  //           ['Symbol', 'Name', 'Price', '24h Change (%)', 'Market Cap', 'Volume'],
  //           ...data.map((item) => [
  //             item.symbol,
  //             item.name,
  //             formatPrice(item.price),
  //             item.change.toFixed(2),
  //             formatLargeNumber(item.value),
  //             formatLargeNumber(item.volume),
  //           ]),
  //         ]
  //           .map((row) => row.join(','))
  //           .join('\n');

  //         const blob = new Blob([csvContent], { type: 'text/csv' });
  //         const url = URL.createObjectURL(blob);
  //         const link = document.createElement('a');
  //         link.href = url;
  //         link.download = `market-heatmap-${Date.now()}.csv`;
  //         link.click();
  //         URL.revokeObjectURL(url);
  //       } else {
  //         // PNG/SVG export
  //         const link = document.createElement('a');
  //         link.href = dataUrl;
  //         link.download = `market-heatmap-${Date.now()}.${format === 'png' ? 'png' : 'svg'}`;
  //         link.click();
  //       }
  //     } catch (err) {
  //       console.error('Export failed:', err);
  //     }
  //   },
  //   [data]
  // );

  return (
    <BaseChart
      title={chartTitle}
      height={height}
      loadingState={loadingState}
      isEmpty={!data || data.length === 0}
      onRetry={refetch}
    >
      <div className={styles.marketHeatmap}>
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{ height: '100%', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </BaseChart>
  );
};