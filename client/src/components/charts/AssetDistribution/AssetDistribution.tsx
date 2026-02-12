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

import React, { useMemo, useRef, useCallback } from 'react';
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
import { BorderFull, BorderTop } from '@carbon/react/icons';

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

  const { filters, setTimePeriod, setWallets, isValid } = useChartFilters({
    initialFilters,
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo<DistributionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: filters.wallets?.join(','),
    }),
    [filters.timePeriod, filters.wallets]
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
        const csv: ChartDataSeries[] = [
          {
            id: 'asset-distribution',
            name: 'Asset Distribution',
            type: 'pie',
            visible: true,
            data: data.data.map(a => ({
              name: a.name,
              value: a.value,
            })),
          },
        ];
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
   * ECharts option = pure function of data + theme
   */
  const option: EChartsOption | null = useMemo(() => {
    if (!data || data.data.length === 0) return null;

    const base = getThemedChartBaseOption(chartTheme);
    const total = data.totalValue;

    return {
      ...base,
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
        top: 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['40%', '60%'],
          center: ['50%', '50%'],
          data: data.data.map((a, i) => ({
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
          left: '12%',
          top: '8%',
          style: {
            text: t('charts.assetDistributionChart.totalValue'),
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: '12%',
          top: '12%',
          style: {
            text: formatCurrency(total),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
            BorderTop
          },
        },
      ],
    };
  }, [data, chartTheme, t]);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!data || data.data.length === 0}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
    >
      {option && (
        <ReactECharts
          ref={chartRef}
          option={option}
          style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
          notMerge
          lazyUpdate
        />
      )}
    </ChartWrapper>
  );
};

