import { useMemo, useState, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';

import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { getThemedChartBaseOption, useChartTheme } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchHoldingDurations, type InferFetcherData } from '@/services/chart/chartApi';
import { createTooltipHeader, createSeriesIndicator } from '@/util/tooltip-helpers';
import { getConditionalLegend } from '@/util/chart-legend-config';
import { isChartSuccess } from '@/util/chart-helpers';

import type { HoldingsRequestParams } from '@/types/chart-api.types';

import sharedStyles from '../shared/ChartStyle.module.scss';
import { useStandardChartController } from '@/hooks/useChartController';
import { BaseChart } from '../Base/BaseChart';
import { ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';


export type TimeUnit = 'days' | 'weeks' | 'months';
type HoldingDurationsData = InferFetcherData<typeof fetchHoldingDurations>

// export interface HoldingDurationsProps {
//   title?: string;
//   minHeight?: number;
//   walletIds?: string[];
//   topN?: number;
//   timeUnit?: TimeUnit;
//   autoRefresh?: boolean;
//   refreshInterval?: number;
//   className?: string;
// }

export const HoldingDurations: React.FC<ChartProps> = ({
  title,
  minHeight = 400,
  initialFilters = {
    wallets: [],
    topN: 10,
    timeUnit: 'days',
  },
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}) => {
  const { tr } = useLocalization();
  const chartTitle = title ?? tr('charts.holdingDurationsChart.title');

  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Extract values from initialFilters - using type assertion for custom properties
  const customFilters = initialFilters as any;
  const initialTopN = typeof customFilters?.topN === 'number' ? customFilters.topN : 10;
  const initialUnit =
    customFilters?.timeUnit === 'weeks' ||
    customFilters?.timeUnit === 'months' ||
    customFilters?.timeUnit === 'days'
      ? customFilters.timeUnit
      : 'days';
  const initialWallets = Array.isArray(initialFilters?.wallets) ? initialFilters.wallets : undefined;

  const [selectedTopN, setSelectedTopN] = useState(initialTopN);
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit>(initialUnit);

  // Use centralized filter sync hook
  const { filters, walletsString } = useChartFiltersSync({
    initialFilters: { wallets: initialWallets },
    debounceDelay: 300,
  });

  /**
   * Memoize query to prevent unnecessary re-fetches
   */
  const query = useMemo <HoldingsRequestParams>(
    () => ({
      walletIds: walletsString,
      topN: selectedTopN,
      timeUnit: selectedUnit,
      timezone,
    }),
    [walletsString, selectedTopN, selectedUnit, timezone]
  );

  /**
   * Unified lifecycle controller
   */
  const { data, loadingState, refetch } =
    useStandardChartController<HoldingDurationsData, HoldingsRequestParams>({
      fetcher: fetchHoldingDurations,
      query,
      autoRefresh,
      refreshInterval,
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
        ? tr('charts.holdingDurationsChart.weeks')
        : selectedUnit === 'months'
        ? tr('charts.holdingDurationsChart.months')
        : tr('charts.holdingDurationsChart.days'),
    [selectedUnit, tr]
  );

  /**
   * Export policy (standardized)
   */
  // const { exportPNG, exportSVG, exportCSV } = useChartExport({
  //   chartTitle,
  //   timezone,
  //   baseFilename: 'holding-duration',
  // });
  // const handleExport = useCallback(
  //   (format: ExportFormat) => {
  //     if (!data) return;

  //     if (format === 'csv') {
  //       const csv: ChartDataSeries[] = data.wallets.map(w => ({
  //         id: w.id,
  //         name: w.name,
  //         type: 'bar',
  //         visible: true,
  //         data: w.holdings.map(h => ({
  //           name: h.tokenSymbol,
  //           value: convert(h.durationDays),
  //         })),
  //       }));
  //       exportCSV(csv, filters);
  //       return;
  //     }

  //     const firstChart =
  //       chartRefs.current.values().next().value?.getEchartsInstance();

  //     if (!firstChart) return;

  //     format === 'png'
  //       ? exportPNG(firstChart as any, filters)
  //       : exportSVG(firstChart as any, filters);
  //   },
  //   [data, filters, convert]
  // );

  /**
   * Build chart option with multiple wallets as series
   */
  const chartOption = useMemo<EChartsOption | null>(() => {
    if (!isChartSuccess(data, 'wallets') || data.wallets.length === 0) return null;

    const base = getThemedChartBaseOption(chartTheme);
    
    // Filter out invalid wallets and ensure they have required properties
    const validWallets = data.wallets.filter(
      wallet => wallet && wallet.name && Array.isArray(wallet.holdings)
    );
    
    if (validWallets.length === 0) return null;
    
    // Collect all unique tokens across all wallets
    const tokenSet = new Set<string>();
    validWallets.forEach(wallet => {
      wallet.holdings.forEach(holding => {
        if (holding?.tokenSymbol) {
          tokenSet.add(holding.tokenSymbol);
        }
      });
    });

    const categories = Array.from(tokenSet);
    
    // Create a series for each wallet
    const series = validWallets.map(wallet => {
      const tokenToValue = new Map(
        wallet.holdings
          .filter(holding => holding?.tokenSymbol && typeof holding.durationDays === 'number')
          .map(holding => [holding.tokenSymbol, convert(holding.durationDays)])
      );

      return {
        name: wallet.name,
        type: 'bar' as const,
        data: categories.map(token => tokenToValue.get(token) ?? 0),
        emphasis: { focus: 'series' as const },
        label: { show: false },
      };
    });

    return {
      ...base,
      legend: getConditionalLegend(
        chartTheme,
        validWallets.map(w => w.name),
        2,
        false
      ),
      grid: { 
        left: '8%',
        right: '8%',
        bottom: '12%',
        top: '20%',
        containLabel: true 
      },
      xAxis: {
        ...base.xAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...base.xAxis.axisLabel,
          rotate: 45,
          interval: 0,
          formatter: (value: string) => (value.length > 20 ? `${value.substring(0, 17)}...` : value),
        },
      },
      yAxis: {
        ...base.yAxis,
        type: 'value',
        name: `${tr('charts.holdingDurationsChart.duration')} (${unitLabel})`,
        nameTextStyle: { color: chartTheme.textColor },
      },
      tooltip: {
        ...base.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(50, 50, 50, 0.95)',
        borderWidth: 1,
        borderColor: chartTheme.borderColor || '#ccc',
        textStyle: { color: chartTheme.textColor },
        formatter: (params: any) => {
          const items = Array.isArray(params) ? params : [params];
          if (items.length === 0) return '';
          
          const tokenName = items[0]?.axisValue || 'Unknown';
          const tooltip = createTooltipHeader(tokenName, 'font-size: 14px;');
          
          const lines = items
            .filter((p: any) => p.value !== null && p.value !== undefined)
            .map((p: any) => {
              const value = Number(p.value);
              const formattedValue = value > 0 ? value.toFixed(1) : '0.0';
              return `<div style="margin-top: 4px;">${createSeriesIndicator(p.color)}<span style="display: inline-block; min-width: 100px;">${p.seriesName}</span>: <strong>${formattedValue}</strong> ${unitLabel.toLowerCase()}</div>`;
            });
          
          return tooltip + lines.join('');
        },
      },
      series,
    };
  }, [data, chartTheme, convert, unitLabel, tr]);

  // Check if we have valid data to display
  const isEmpty = !isChartSuccess(data, 'wallets') || data.wallets.length === 0 || chartOption === null;

  return (
    <BaseChart
      title={chartTitle}
      // height={height * (data?.wallets.length || 1)}
      loadingState={loadingState}
      isEmpty={isEmpty}
      onRetry={() => refetch(false)}
    >
      <div className={`${sharedStyles.chartControls} ${sharedStyles['chartControls--end']} ${sharedStyles['chartControls--withBackground']}`}>
        <select value={selectedUnit} onChange={e => setSelectedUnit(e.target.value as TimeUnit)} className={sharedStyles.chartSelect}>
          <option value="days">{tr('charts.holdingDurationsChart.days')}</option>
          <option value="weeks">{tr('charts.holdingDurationsChart.weeks')}</option>
          <option value="months">{tr('charts.holdingDurationsChart.months')}</option>
        </select>

        <select value={selectedTopN} onChange={e => setSelectedTopN(+e.target.value)} className={sharedStyles.chartSelect}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={15}>15</option>
          <option value={20}>20</option>
        </select>
      </div>

      {chartOption && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            option={chartOption}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            notMerge
            lazyUpdate
          />
        </ChartGridItem>
      )}
    </BaseChart>
  );
}