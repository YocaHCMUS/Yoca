/**
 * TradingVolumeDistribution Component
 * 
 * Displays a donut chart showing trading volume distribution across different tokens
 * with percentages and values for each wallet.
 * 
 * Features:
 * - Donut chart with colored segments for each token
 * - Center display showing total trading volume
 * - Percentages and values on segments
 * - Interactive legend with toggle capability
 * - Per-wallet view with multiple donut charts
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/TradingVolumeDistribution
 */

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchTradingVolumeDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency, isChartSuccess } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import { getPieLegend } from '@/util/chart-legend-config';
import type { TradingVolumeDistributionRequestParams } from '@/types/chart-api.types';

type TradingVolumeDistributionData = InferFetcherData<typeof fetchTradingVolumeDistribution>;
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper, ChartGrid, ChartGridItem } from '@/components/charts/shared';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartProps } from '../shared/ChartProp';

// export interface AssetDistributionProps {
//   minHeight?: number;
//   initialFilters?: Partial<any>;
//   autoRefresh?: boolean;
//   refreshInterval?: number;
//   className?: string;
// }

export const TradingVolumeDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}) => {
  const { tr } = useLocalization();
  const chartTitle = tr('charts.tradingVolumeDistributionChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // Track selected assets for legend filtering
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<TradingVolumeDistributionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString]
  );

  /**
   * Centralized lifecycle handling
   */
  const { data, loadingState, refetch } =
    useStandardChartController<TradingVolumeDistributionData, TradingVolumeDistributionRequestParams>({
      fetcher: fetchTradingVolumeDistribution,
      query,
      autoRefresh,
      refreshInterval,
    });

  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'trading-volume-distribution',
  });

  /**
   * Handle export based on format
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!isChartSuccess(data, 'wallets')) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;

      if (format === 'csv') {
        // Convert trading volume distribution data to CSV format
        const csv: ChartDataSeries[] = [];
        
        if (data.wallets) {
          // Per-wallet data
          data.wallets.forEach(wallet => {
            csv.push({
              id: `trading-volume-distribution-${wallet.walletAddress}`,
              name: `Trading Volume Distribution - ${wallet.walletAddress}`,
              type: 'pie',
              visible: true,
              data: wallet.data.map(t => ({
                name: t.name,
                value: t.value,
              })),
            });
          });
        }
        
        exportCSV(csv, filters);
        return;
      }

      if (!instance) {
        console.error('Chart instance not available for export');
        return;
      }

      // Export as PNG or SVG
      format === 'png'
        ? exportPNG(instance as any, filters)
        : exportSVG(instance as any, filters);
    },
    [data, filters, exportPNG, exportSVG, exportCSV]
  );

  /**
   * Helper to create chart option for a single distribution dataset
   */
  const createChartOption = useCallback((
    distributionData: { name: string; value: number; percentage: number; color?: string }[],
    total: number,
    walletLabel?: string,
    isMultiWallet?: boolean
  ): EChartsOption => {
    const base = getThemedChartBaseOption(chartTheme);
    
    // Filter data based on selected assets in multi-wallet view
    const filteredData = isMultiWallet && selectedAssets.size > 0
      ? distributionData.filter(a => selectedAssets.has(a.name))
      : distributionData;
    
    // Recalculate total and percentages for filtered data
    const filteredTotal = filteredData.reduce((sum, a) => sum + a.value, 0);
    const dataWithRecalculatedPercentages = filteredData.map(a => ({
      ...a,
      percentage: filteredTotal > 0 ? (a.value / filteredTotal) * 100 : 0,
    }));

    return {
      ...base,
      xAxis: undefined,
      yAxis: undefined,
      title: walletLabel ? {
        text: walletLabel,
        left: 8,
        top: 8,
        textStyle: {
          color: chartTheme.textColor,
          fontSize: 16,
          fontWeight: 'bold',
        },
      } : undefined,
      tooltip: {
        ...base.tooltip,
        trigger: 'item',
        formatter: (p: any) => createTooltipHeader(p.name)
          + createTooltipRow(
              tr('charts.tradingVolumeDistributionChart.volume'),
              formatCurrency(p.value)
            )
          + createTooltipRow(
              tr('charts.tradingVolumeDistributionChart.percentage'),
              `${p.data.percentage.toFixed(2)}%`
            ),
      },
      legend: getPieLegend(
        chartTheme,
        distributionData.map(d => d.name),
        !isMultiWallet
      ),
      series: [
        {
          type: 'pie',
          radius: ['26%', '56%'],
          center: ['50%', '50%'],
          data: dataWithRecalculatedPercentages.map((a, i) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            itemStyle: {
              color:
                (a as any).color ??
                chartTheme.colorPalette[i % chartTheme.colorPalette.length],
              borderColor: '#ffffff',
              borderWidth: 2,
              borderRadius: 6,
            },
          })),
          label: {
            formatter: (p: any) => `${p.name}\n${p.data.percentage.toFixed(1)}%`,
            fontSize: 11,
          },
        },
      ],
      graphic: [
        {
          type: 'text',
          left: 'center',
          top: '46%',
          style: {
            text: tr('charts.tradingVolumeDistributionChart.totalVolume'),
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '50%',
          style: {
            text: formatCurrency(isMultiWallet && selectedAssets.size > 0 ? filteredTotal : total),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [chartTheme, tr, selectedAssets]);

  /**
   * Extract unique assets across all wallets for aggregated legend
   */
  const aggregatedLegendData = useMemo(() => {
    if (!isChartSuccess(data, 'wallets')) return null;
    if (data.wallets.length <= 1) return null;
    
    const uniqueAssets = new Map<string, { name: string; color: string }>();
    
    data.wallets.forEach((wallet, walletIndex) => {
      wallet.data.forEach((token, tokenIndex) => {
        if (!uniqueAssets.has(token.name)) {
          uniqueAssets.set(token.name, {
            name: token.name,
            color: (token as any).color ?? chartTheme.colorPalette[tokenIndex % chartTheme.colorPalette.length],
          });
        }
      });
    });
    
    return Array.from(uniqueAssets.values());
  }, [data, chartTheme.colorPalette]);
  
  /**
   * Initialize selected assets when data changes
   */
  useEffect(() => {
    if (aggregatedLegendData) {
      setSelectedAssets(new Set(aggregatedLegendData.map(a => a.name)));
    }
  }, [aggregatedLegendData]);
  
  /**
   * Toggle asset selection for legend filtering
   */
  const toggleAssetSelection = useCallback((assetName: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetName)) {
        // Don't allow deselecting all assets
        if (newSet.size > 1) {
          newSet.delete(assetName);
        }
      } else {
        newSet.add(assetName);
      }
      return newSet;
    });
  }, []);

  /**
   * ECharts options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!isChartSuccess(data, 'wallets')) return [];

    const isMultiWallet = data.wallets.length > 1;

    // Multi-wallet or single wallet view
    if (data.wallets.length > 0) {
      return data.wallets.map(wallet => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.data,
          wallet.totalVolume,
          `${wallet.walletAddress.slice(0, 8)}...`,
          isMultiWallet
        ),
      }));
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty = !isChartSuccess(data, 'wallets') || data.wallets.length === 0 || (filters.wallets && filters.wallets.length === 0);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={filters.wallets && filters.wallets.length === 0 
        ? {
            title: tr('charts.tradingVolumeDistributionChart.noWalletsTitle'),
            message: tr('charts.tradingVolumeDistributionChart.noWalletsMessage'),
          }
        : undefined}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
    >
      {chartOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Aggregated Legend for Multi-Wallet View */}
          {aggregatedLegendData && chartOptions.length > 1 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '1rem',
                padding: '1rem',
                justifyContent: 'center',
                borderBottom: '1px solid var(--cds-border-subtle)',
                marginBottom: '1rem',
              }}
            >
              {aggregatedLegendData.map((asset) => {
                const isSelected = selectedAssets.has(asset.name);
                return (
                  <div
                    key={asset.name}
                    onClick={() => toggleAssetSelection(asset.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      cursor: 'pointer',
                      opacity: isSelected ? 1 : 0.3,
                      transition: 'opacity 0.2s ease',
                      userSelect: 'none',
                    }}
                    title={isSelected ? `Click to hide ${asset.name}` : `Click to show ${asset.name}`}
                  >
                    <span
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: asset.color,
                        opacity: isSelected ? 1 : 0.5,
                      }}
                    />
                    <span
                      style={{
                        fontSize: '14px',
                        color: chartTheme.textColor,
                      }}
                    >
                      {asset.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Chart Grid */}
          <ChartGrid itemCount={chartOptions.length} multiItemColumns={3}>
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
                aspectRatio="1"
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                  notMerge
                  lazyUpdate
                />
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </ChartWrapper>
  );
};

