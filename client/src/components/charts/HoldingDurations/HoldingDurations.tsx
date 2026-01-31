import { useMemo, useRef, useState, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useTranslation } from 'react-i18next';

import { useChartFilters } from '../../../hooks/useChartFilters';
import { getThemedChartBaseOption, useChartTheme } from '../../../hooks/useChartTheme';
import { useChartContext } from '../../../contexts/ChartContext';
import { fetchHoldingDurations } from '../../../services/chart/chartApi';

import type { HoldingDurationsResponse } from '../../../types/chart-api.types';
import type { ChartDataSeries } from '../../../types/chart-data.types';
import type { ExportFormat } from '../../../types/chart-filters.types';

import styles from '@/components/charts/HoldingDurations/HoldingDurations.module.scss';
import { useStandardChartController } from '@/hooks/useChartController';
import { useChartExport } from '@/hooks/useChartExport';
import { BaseChart } from '../Base/BaseChart';


export type TimeUnit = 'days' | 'weeks' | 'months';

export interface HoldingDurationsProps {
  title?: string;
  height?: number;
  walletIds?: string[];
  topN?: number;
  timeUnit?: TimeUnit;
  autoRefresh?: boolean;
  className?: string;
}

export function HoldingDurations({
  title,
  height = 300,
  walletIds = [],
  topN = 10,
  timeUnit = 'days',
  autoRefresh = false,
  className,
}: HoldingDurationsProps) {
  const { t } = useTranslation();
  const chartTitle = title ?? t('charts.holdingDurationsChart.title');

  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  const [selectedTopN, setSelectedTopN] = useState(topN);
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit>(timeUnit);

  const chartRefs = useRef<Map<string, ReactECharts>>(new Map());

  const { filters } = useChartFilters({
    initialFilters: {
      wallets: walletIds.length ? walletIds : undefined,
    },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo(
    () => ({
      walletIds: filters.wallets?.join(','),
      topN: selectedTopN,
      timeUnit: selectedUnit,
      timezone,
    }),
    [filters.wallets, selectedTopN, selectedUnit, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<HoldingDurationsResponse, any>({
      fetcher: fetchHoldingDurations,
      query,
      autoRefresh,
    });

  /**
   * Time conversion logic (pure)
   */
  const convert = useCallback(
    (days: number) =>
      selectedUnit === 'weeks'
        ? days / 7
        : selectedUnit === 'months'
        ? days / 30
        : days,
    [selectedUnit]
  );

  const unitLabel = useMemo(
    () =>
      selectedUnit === 'weeks'
        ? t('charts.holdingDurationsChart.weeks')
        : selectedUnit === 'months'
        ? t('charts.holdingDurationsChart.months')
        : t('charts.holdingDurationsChart.days'),
    [selectedUnit, t]
  );

  /**
   * Export policy (standardized)
   */
  const { exportPNG, exportSVG, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'holding-duration',
  });
  const handleExport = useCallback(
    (format: ExportFormat) => {
      if (!data) return;

      if (format === 'csv') {
        const csv: ChartDataSeries[] = data.wallets.map(w => ({
          id: w.id,
          name: w.name,
          type: 'bar',
          visible: true,
          data: w.holdings.map(h => ({
            name: h.tokenSymbol,
            value: convert(h.durationDays),
          })),
        }));
        exportCSV(csv, filters);
        return;
      }

      const firstChart =
        chartRefs.current.values().next().value?.getEchartsInstance();

      if (!firstChart) return;

      format === 'png'
        ? exportPNG(firstChart as any, filters)
        : exportSVG(firstChart as any, filters);
    },
    [data, filters, convert]
  );

   /**
   * Option factory (pure, deterministic)
   */
  const buildOptions = useCallback(
    (wallet: HoldingDurationsResponse['wallets'][0]) => {
      const base = getThemedChartBaseOption(chartTheme);

      return {
        ...base,
        grid: { top: 40, left: 80, right: 40, bottom: 60 },
        xAxis: {
          type: 'category',
          data: wallet.holdings.map(h => h.tokenSymbol),
          axisLabel: { rotate: 45 },
        },
        yAxis: {
          type: 'value',
          name: `${t('charts.holdingDurationsChart.duration')} (${unitLabel})`,
          nameLocation: 'middle',
          nameGap: 60,
        },
        tooltip: {
          trigger: 'axis',
          formatter: ([p]: any[]) =>
            `<strong>${p.name}</strong><br/>${p.value.toFixed(
              1
            )} ${unitLabel.toLowerCase()}`,
        },
        series: [
          {
            type: 'bar',
            data: wallet.holdings.map(h => convert(h.durationDays)),
            itemStyle: { color: chartTheme.colorPalette[0] },
            label: { show: true, position: 'top', fontSize: 10 },
          },
        ],
      };
    },
    [chartTheme, convert, unitLabel, t]
  );

  return (
    <BaseChart
      title={chartTitle}
      height={height * (data?.wallets.length || 1)}
      loadingState={loadingState}
      isEmpty={!data || data.wallets.length === 0}
      onRetry={() => refetch(false)}
      onExport={handleExport}
    >
      <div className={styles.holdingDurations}>
        {/* Controls */}
        <div className={styles.controls}>
          <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as TimeUnit)}>
            <option value="days">{t('charts.holdingDurationsChart.days')}</option>
            <option value="weeks">{t('charts.holdingDurationsChart.weeks')}</option>
            <option value="months">{t('charts.holdingDurationsChart.months')}</option>
          </select>

          <select value={selectedTopN} onChange={e => setSelectedTopN(+e.target.value)}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>

        {data?.wallets.map(wallet => (
          <div key={wallet.id} className={styles.walletChart}>
            <div className={styles.walletTitle}>{wallet.name}</div>

            <ReactECharts
              ref={ref => {
                if (ref) {
                  chartRefs.current.set(wallet.id, ref);
                } else {
                  chartRefs.current.delete(wallet.id);
                }
              }}
              option={buildOptions(wallet)}
              style={{ height }}
              notMerge
              lazyUpdate
            />
          </div>
        ))}
      </div>
    </BaseChart>
  );
}