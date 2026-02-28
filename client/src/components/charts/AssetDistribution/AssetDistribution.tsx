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

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
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

/** When provided, the chart uses this data instead of the distribution API (e.g. from wallet portfolio). */
export interface PortfolioOverride {
  data: Array<{ name: string; value: number; percentage: number }>;
  totalValue: number;
}

export interface AssetDistributionProps extends ChartProps {
  /** Optional real portfolio data; when set, API is skipped and this is used for the donut. */
  portfolioOverride?: PortfolioOverride;
}

export const AssetDistribution: React.FC<AssetDistributionProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  portfolioOverride,
}) => {
  const { t } = useTranslation();
  const chartTitle = t('charts.assetDistributionChart.title');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();
  
  // Track selected assets for legend filtering
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // Use centralized filter sync hook (only used when not using portfolio override)
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

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
   * When portfolioOverride is set, stub fetcher returns it (no API call); otherwise use distribution API.
   */
  const fetcher = useCallback(
    (q: DistributionRequestParams): Promise<AssetDistributionResponse> =>
      portfolioOverride
        ? Promise.resolve({
            data: portfolioOverride.data,
            totalValue: portfolioOverride.totalValue,
            metadata: { currency: 'USD', timestamp: Date.now() },
          })
        : fetchAssetDistribution(q),
    [portfolioOverride]
  );

  const { data, loadingState, refetch } =
    useStandardChartController<AssetDistributionResponse, DistributionRequestParams>({
      fetcher,
      query,
      autoRefresh: portfolioOverride ? false : autoRefresh,
      refreshInterval,
    });

  /** When portfolioOverride has data, use it so the chart shows immediately without waiting for controller. */
  const effectiveData: AssetDistributionResponse | null =
    portfolioOverride && portfolioOverride.data.length > 0
      ? {
          data: portfolioOverride.data,
          totalValue: portfolioOverride.totalValue,
          metadata: { currency: 'USD', timestamp: Date.now() },
        }
      : data;

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
      if (!effectiveData) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;

      if (format === 'csv') {
        // Convert asset distribution data to CSV format
        const csv: ChartDataSeries[] = [];
        
        if (effectiveData.wallets) {
          // Per-wallet data
          effectiveData.wallets.forEach(wallet => {
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
        } else if (effectiveData.data) {
          // Aggregated data
          csv.push({
            id: 'asset-distribution',
            name: 'Asset Distribution',
            type: 'pie',
            visible: true,
            data: effectiveData.data.map(a => ({
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
    [effectiveData, filters, exportPNG, exportSVG, exportCSV]
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
    if (!effectiveData || !effectiveData.wallets || effectiveData.wallets.length <= 1) return null;
    
    const uniqueAssets = new Map<string, { name: string; color: string }>();
    
    effectiveData.wallets.forEach((wallet, walletIndex) => {
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
  }, [effectiveData, chartTheme.colorPalette]);
  
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
    if (!effectiveData) return [];

    const isMultiWallet = effectiveData.wallets && effectiveData.wallets.length > 1;

    // Multi-wallet view
    if (effectiveData.wallets && effectiveData.wallets.length > 0) {
      return effectiveData.wallets.map(wallet => ({
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
    if (effectiveData.data && effectiveData.data.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(effectiveData.data, effectiveData.totalValue ?? 0, undefined, false),
      }];
    }

    return [];
  }, [effectiveData, createChartOption]);

  const noWalletsSelected = filters.wallets && filters.wallets.length === 0;
  const hasNoChartData = !effectiveData || (
    (!effectiveData.wallets || effectiveData.wallets.length === 0) &&
    (!effectiveData.data || effectiveData.data.length === 0)
  );
  const isEmpty = hasNoChartData || (noWalletsSelected && !portfolioOverride);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={noWalletsSelected && !portfolioOverride
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

