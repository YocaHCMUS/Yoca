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

import React, { useMemo, useRef } from 'react';
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
import { BaseChart } from '@/components/charts/Base/BaseChart';


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


  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'asset-distribution',
  // });
  // const handleExport = useCallback(
  //   (format: ExportFormat) => {
  //     if (!data) return;

  //     const instance = chartRef.current?.getEchartsInstance() ?? null;

  //     if (format === 'csv') {
  //       const csv: ChartDataSeries[] = [
  //         {
  //           id: 'asset-distribution',
  //           name: 'Asset Distribution',
  //           type: 'pie',
  //           visible: true,
  //           data: data.data.map(a => ({
  //             name: a.name,
  //             value: a.value,
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
        right: 20,
        top: 'center',
      },
      series: [
        {
          type: 'pie',
          radius: ['50%', '70%'],
          center: ['40%', '50%'],
          data: data.data.map((a, i) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            itemStyle: {
              color:
                (a as any).color ??
                chartTheme.colorPalette[i % chartTheme.colorPalette.length],
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
          left: '14%',
          top: '14%',
          style: {
            text: t('charts.assetDistributionChart.totalValue'),
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: '14%',
          top: '20%',
          style: {
            text: formatCurrency(total),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [data, chartTheme, t]);

  return (
    <BaseChart
      title={chartTitle}
      // height={height}
      loadingState={loadingState}
      isEmpty={!data || data.data.length === 0}
      onRetry={() => refetch(false)}
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
    </BaseChart>
  );
};

