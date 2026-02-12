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

import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useTranslation } from 'react-i18next';
import { useChartFilters } from '@/hooks/useChartFilters';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import type { AssetDistributionResponse, DistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper } from '@/components/charts/shared/ChartWrapper';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';

export interface AssetDistributionProps {
  minHeight?: number;
  initialFilters?: Partial<any>;
  autoRefresh?: boolean;
  refreshInterval?: number;
  className?: string;
}

export const AssetDistribution: React.FC<AssetDistributionProps> = ({
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
    if (initialFilters?.wallets) {
      const prevWalletsStr = prevFilters?.wallets?.sort().join(',') ?? '';
      const newWalletsStr = initialFilters.wallets.sort().join(',');
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
    if (!filters.wallets || filters.wallets.length === 0) return undefined;
    return filters.wallets.sort().join(',');
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
    walletLabel?: string
  ): EChartsOption => {
    const base = getThemedChartBaseOption(chartTheme);

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
        formatter: (p: any) => `
          <strong>${p.name}</strong><br/>
          ${t('charts.assetDistributionChart.value')}: ${formatCurrency(p.value)}<br/>
          ${t('charts.assetDistributionChart.percentage')}: ${p.data.percentage.toFixed(2)}%
        `,
      },
      legend: {
        ...base.legend,
        orient: 'vertical',
        right: 0,
        top: walletLabel ? 'center' : 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['26%', '56%'],
          center: ['50%', '50%'],
          data: distributionData.map((a, i) => ({
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
            text: formatCurrency(total),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [chartTheme, t]);

  /**
   * ECharts options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!data) return [];

    // Multi-wallet view
    if (data.wallets && data.wallets.length > 0) {
      return data.wallets.map(wallet => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.data,
          wallet.totalValue,
          `Wallet: ${wallet.walletAddress.slice(0, 6)}...${wallet.walletAddress.slice(-4)}`
        ),
      }));
    }

    // Single/aggregated view
    if (data.data && data.data.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(data.data, data.totalValue ?? 0),
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
      )}
    </ChartWrapper>
  );
};

