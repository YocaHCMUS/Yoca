/**
 * AssetDistribution Component
 * 
 * Displays a donut chart showing cryptocurrency asset allocation with percentages,
 * values, and total portfolio value at the center.
 * 
 * Features:
 * - Donut chart with colored segments for each asset
 * - Center display showing total portfolio value
 * - Percentages and values on segments
 * - Interactive legend with toggle capability
 * - Token filtering support (All or specific tokens)
 * - Auto-refresh every 30 seconds
 * - Export to PNG/SVG/CSV
 * - Fullscreen and mini-player viewing modes
 * 
 * @module components/charts/AssetDistribution
 */

import React, { useMemo, useRef, useCallback, useEffect, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import type { AssetDistributionResponse, DistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper } from '@/components/charts/shared/ChartWrapper';
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

export const AssetDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}) => {
  const { t } = useTranslation();
  const chartTitle = t('charts.assetDistributionChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // Track selected assets for legend filtering
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  
  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);

  const { filters, setTimePeriod, setWallets, isValid } = useChartFilters({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Sync filters when initialFilters changes (e.g., wallet selection from parent)
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;
    
    // Check if wallets changed
    if (initialFilters?.wallets && Array.isArray(initialFilters.wallets)) {
      const prevWallets = Array.isArray(prevFilters?.wallets) ? prevFilters.wallets : [];
      const prevWalletsStr = prevWallets.slice().sort().join(',');
      const newWalletsStr = initialFilters.wallets.slice().sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }
    
    // Check if time period changed
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }
    
    // Update ref for next comparison
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod]);

  /**
   * Memoize wallets string to prevent unnecessary re-fetches
   * Only changes when wallet addresses actually change, not on array reference change
   */
  const walletsString = useMemo(() => {
    if (!filters.wallets || !Array.isArray(filters.wallets) || filters.wallets.length === 0) return undefined;
    return filters.wallets.slice().sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<DistributionRequestParams>(
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
    useStandardChartController<AssetDistributionResponse, DistributionRequestParams>({
      fetcher: fetchAssetDistribution,
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
    baseFilename: 'asset-distribution',
  });

  /**
   * Handle export based on format
   */
  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!data) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;

      if (format === 'csv') {
        // Convert asset distribution data to CSV format
        const csv: ChartDataSeries[] = [];
        
        if (data.wallets) {
          // Per-wallet data
          data.wallets.forEach(wallet => {
            csv.push({
              id: `asset-distribution-${wallet.walletAddress}`,
              name: `Asset Distribution - ${wallet.walletAddress}`,
              type: 'pie',
              visible: true,
              data: wallet.data.map(a => ({
                name: a.name,
                value: a.value,
              })),
            });
          });
        } else if (data.data) {
          // Aggregated data
          csv.push({
            id: 'asset-distribution',
            name: 'Asset Distribution',
            type: 'pie',
            visible: true,
            data: data.data.map(a => ({
              name: a.name,
              value: a.value,
            })),
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
              t('charts.assetDistributionChart.value'),
              formatCurrency(p.value)
            )
          + createTooltipRow(
              t('charts.assetDistributionChart.percentage'),
              `${p.data.percentage.toFixed(2)}%`
            ),
      },
      legend: isMultiWallet ? {
        show: false, // Hide individual legends in multi-wallet view
      } : {
        ...base.legend,
        orient: 'vertical',
        right: 0,
        top: 'center',
      },
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
            text: t('charts.assetDistributionChart.totalValue'),
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
  }, [chartTheme, t, selectedAssets]);

  /**
   * Extract unique assets across all wallets for aggregated legend
   */
  const aggregatedLegendData = useMemo(() => {
    if (!data || !data.wallets || data.wallets.length <= 1) return null;
    
    const uniqueAssets = new Map<string, { name: string; color: string }>();
    
    data.wallets.forEach((wallet, walletIndex) => {
      wallet.data.forEach((asset, assetIndex) => {
        if (!uniqueAssets.has(asset.name)) {
          uniqueAssets.set(asset.name, {
            name: asset.name,
            color: (asset as any).color ?? chartTheme.colorPalette[assetIndex % chartTheme.colorPalette.length],
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
    if (!data) return [];

    const isMultiWallet = data.wallets && data.wallets.length > 1;

    // Multi-wallet view
    if (data.wallets && data.wallets.length > 0) {
      return data.wallets.map(wallet => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.data,
          wallet.totalValue,
          `Wallet: ${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}`,
          isMultiWallet
        ),
      }));
    }

    // Single/aggregated view
    if (data.data && data.data.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(data.data, data.totalValue ?? 0, undefined, false),
      }];
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty = !data || (
    (!data.wallets || data.wallets.length === 0) &&
    (!data.data || data.data.length === 0)
  ) || (filters.wallets && filters.wallets.length === 0);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={filters.wallets && filters.wallets.length === 0 
        ? {
            title: t('charts.assetDistributionChart.noWalletsTitle', 'No Wallets Selected'),
            message: t('charts.assetDistributionChart.noWalletsMessage', 'Please select at least one wallet to view asset distribution.'),
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
                        border: isSelected ? 'none' : '2px solid currentColor',
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
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: chartOptions.length > 1 ? 'repeat(3, 1fr)' : '1fr',
              width: '100%',
            }}
          >
            {chartOptions.map((chartData, index) => (
              <div
                key={chartData.walletAddress}
                style={{
                  aspectRatio: '1',
                  minHeight: `${minHeight}px`,
                  // maxHeight: '600px',
                  border: chartOptions.length > 1 ? '1px solid var(--cds-border-subtle)' : 'none',
                  borderRadius: '4px',
                  padding: chartOptions.length > 1 ? '0.5rem' : '0',
                }}
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                  notMerge
                  lazyUpdate
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartWrapper>
  );
};

