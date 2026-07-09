import { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ChartWrapper, ChartGridItem } from '@/components/charts/shared';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from '@/util/carbon-chart-base';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchTransactionDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { formatDate, isChartSuccess } from '@/util/chart-helpers';
import { formatAxisTooltip } from '@/util/tooltip-helpers';
import type { TransactionDistributionRequestParams } from '@/types/chart-api.types';

type TransactionDistributionData = InferFetcherData<typeof fetchTransactionDistribution>;
import type { TimePeriod, TransactionType } from '@/types/chart-filters.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { Flex } from '@/components/Flex';
import { FilterSwitch } from '@/components/FilterSwitch';

interface TransactionDistributionProps {
  title?: string;
  minHeight?: number;
  initialTimePeriod?: TimePeriod;
  initialTransactionType?: TransactionType;
  chartMode?: 'stacked' | 'grouped';
  walletIds?: string[];
  autoRefresh?: boolean;
  refreshInterval?: number;
  onDataLoaded?: (data: TransactionDistributionData) => void;
  className?: string;
}

export function TransactionDistribution({
  title,
  minHeight = 400,
  initialTimePeriod = '30D',
  initialTransactionType = 'all',
  chartMode = 'stacked',
  walletIds = [],
  autoRefresh = true,
  refreshInterval = 30000,
  onDataLoaded,
}: TransactionDistributionProps) {
  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.transactionDistributionChart.title');

  const [selectedChartMode, setSelectedChartMode] = useState<'stacked' | 'grouped'>(chartMode);

  const transactionChartRef = useRef<ReactECharts>(null);
  const tokenChartRef = useRef<ReactECharts>(null);

  const { selectedTimezone: timezone } = useChartContext();
  const baseOption = useCarbonChartBaseOption();

  const { filters, walletsString } = useChartFiltersSync({
    initialFilters: {
      timePeriod: initialTimePeriod,
      transactionType: initialTransactionType,
      wallets: walletIds.length > 0 ? walletIds : undefined,
    },
    debounceDelay: 300,
  });

  const query = useMemo<TransactionDistributionRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      transactionType: filters.transactionType,
      walletIds: walletsString,
      timezone,
    }),
    [filters.timePeriod, filters.transactionType, walletsString, timezone]
  );

  const { data, loadingState, refetch } =
    useStandardChartController<TransactionDistributionData, TransactionDistributionRequestParams>({
      fetcher: fetchTransactionDistribution,
      query,
      autoRefresh,
      refreshInterval,
      onDataLoaded,
    });

  const transactionCountsOptions = useMemo(() => {
    if (!isChartSuccess(data, 'transactionCounts')) {
      return {};
    }

    const series = data.transactionCounts.map((wallet, index) => ({
      name: wallet.walletName,
      type: 'bar' as const,
      stack: selectedChartMode === 'stacked' ? 'total' : undefined,
      data: wallet.data.map(point => [point.timestamp, point.value]),
      label: {
        show: wallet.data.length <= 30,
        position: selectedChartMode === 'stacked' ? 'inside' : 'top',
        formatter: (params: any) => {
          const value = params.value[1];
          return value > 0 ? value.toString() : '';
        },
        fontSize: 10,
      },
      color: CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length],
      emphasis: {
        focus: 'series',
      },
    }));

    return {
      ...baseOption,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        formatter: (params: any) => {
          if (!Array.isArray(params) || params.length === 0) return '';

          const timestamp = params[0].value[0];
          const dateStr = formatDate(new Date(timestamp), timezone);

          let tooltipContent = `<strong>${dateStr}</strong><br/>`;
          let total = 0;

          params.forEach((param: any) => {
            const count = param.value[1];
            total += count;
            const color = param.color;
            tooltipContent += `
              <div style="display: flex; align-items: center; margin-top: 4px;">
                <span style="display: inline-block; width: 10px; height: 10px; background-color: ${color}; margin-right: 8px; border-radius: 50%;"></span>
                <span style="flex: 1;">${param.seriesName}:</span>
                <strong style="margin-left: 8px;">${count}</strong>
              </div>
            `;
          });

          if (selectedChartMode === 'stacked') {
            tooltipContent += `<div style="margin-top: 8px; padding-top: 4px; border-top: 1px solid #ccc;"><strong>Total: ${total}</strong></div>`;
          }

          return tooltipContent;
        },
      },
      legend: {
        show: true,
        data: data.transactionCounts.map(w => w.walletName),
        textStyle: { color: baseOption.textStyle.color },
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatDate(new Date(value), timezone, 'MMM dd'),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Transaction count',
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
        },
      },
      series,
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.transactionCounts[0]?.data.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, selectedChartMode, timezone, baseOption]);

  const uniqueTokenCountsOptions = useMemo(() => {
    if (!isChartSuccess(data, 'transactionCounts')) {
      return {};
    }

    return {
      ...baseOption,
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999',
          },
        },
        formatter: (params: any) => formatAxisTooltip(
          params,
          (p) => formatDate(new Date(p.value[0]), timezone),
          (p) => p.value[1].toString()
        ),
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'time',
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          formatter: (value: number) => formatDate(new Date(value), timezone, 'MMM dd'),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Unique token traded',
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: (value: number) => value.toFixed(0),
        },
      },
      series: [
        {
          name: tr('charts.transactionDistributionChart.tokens'),
          type: 'line',
          data: data.uniqueTokenCounts.map(point => [point.timestamp, point.value]),
          smooth: 0.3,
          showSymbol: data.uniqueTokenCounts.length <= 50,
          symbolSize: 6,
          itemStyle: {
            color: CHART_COLOR_PALETTE[1],
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${CHART_COLOR_PALETTE[1]}4D` },
                { offset: 1, color: `${CHART_COLOR_PALETTE[1]}0D` },
              ],
            },
          },
          label: {
            show: data.uniqueTokenCounts.length <= 30,
            position: 'top',
            formatter: (params: any) => params.value[1].toString(),
            fontSize: 10,
          },
        },
      ],
      dataZoom: [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          show: data.uniqueTokenCounts.length > 50,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
        },
      ],
    };
  }, [data, timezone, baseOption, tr]);

  const handleChartModeChange = (mode: 'stacked' | 'grouped') => {
    setSelectedChartMode(mode);
  };

  const handleRetry = () => {
    refetch(false);
  };

  const chartModeOptions = [
    { value: 'stacked' as const, label: tr('charts.transactionDistributionChart.stacked') },
    { value: 'grouped' as const, label: tr('charts.transactionDistributionChart.grouped') },
  ];

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      onRetry={handleRetry}
      isEmpty={!isChartSuccess(data, 'transactionCounts') || (data.transactionCounts.length === 0 && data.uniqueTokenCounts.length === 0)}
      toolbarLayout="stacked"
      actions={
        <Flex gap={8} align="center">
          <div style={{ width: 160 }}>
            <FilterSwitch
              options={chartModeOptions}
              value={selectedChartMode}
              onChange={(v) => handleChartModeChange(v as 'stacked' | 'grouped')}
            />
          </div>
        </Flex>
      }
    >
      {data && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            ref={transactionChartRef}
            option={transactionCountsOptions}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </ChartGridItem>
      )}

      {data && (
        <ChartGridItem minHeight={minHeight}>
          <ReactECharts
            ref={tokenChartRef}
            option={uniqueTokenCountsOptions}
            style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        </ChartGridItem>
      )}
    </ChartWrapper>
  );
}
