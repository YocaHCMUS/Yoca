import React, { useMemo, useRef, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { formatItemTooltip } from '@/util/tooltip-helpers';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from '@/util/carbon-chart-base';
import { fetchWinrate, type InferFetcherData } from '@/services/chart/chartApi';
import { isChartSuccess } from '@/util/chart-helpers';
import { formatAddress } from '@/util/format';
import type { WinrateRequestParams } from '@/types/chart-api.types';

type WinrateData = InferFetcherData<typeof fetchWinrate>;
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper, ChartContainer, ChartSection, ChartGrid, ChartGridItem } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import { Flex } from '@/components/Flex';
import { FilterSwitch } from '@/components/FilterSwitch';
import { Layer } from '@carbon/react';

export function WinrateChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: '30D',
    wallets: []
  },
  autoRefresh = true,
  refreshInterval = 30000,
  className,
}: ChartProps) {
  const WINRATE_TIME_RANGES = ['24H', '7D', '30D', 'All'] as const;
  type WinrateTimeRange = (typeof WINRATE_TIME_RANGES)[number];

  const { tr } = useLocalization();
  const chartTitle = title || tr('charts.winrateChart.title');
  const [timeRange, setTimeRange] = useState<WinrateTimeRange>('All');

  const overallChartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();

  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<WinrateRequestParams>(
    () => ({
      period: timeRange,
      wallets: walletsString,
    }),
    [timeRange, walletsString]
  );

  const { data, loadingState, refetch } =
    useStandardChartController<WinrateData, WinrateRequestParams>({
      fetcher: fetchWinrate,
      query,
      autoRefresh,
      refreshInterval,
    });

  const overallWinrateOption = useMemo((): EChartsOption | null => {
    if (!isChartSuccess(data, 'wallets') || data.wallets.length === 0) {
      return null;
    }

    const categories = data.wallets.map(w => formatAddress(w.walletAddress));
    const winrateValues = data.wallets.map(w => w.winrate);

    return {
      ...baseOption,
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...baseOption.xAxis.axisLabel,
          interval: 0,
          rotate: categories.length > 5 ? 30 : 0,
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: 'value',
        name: 'Winrate (%)',
        min: 0,
        max: 100,
        axisLabel: {
          ...baseOption.yAxis.axisLabel,
          formatter: '{value}%',
        },
      },
      series: [
        {
          name: 'Winrate',
          type: 'bar',
          data: winrateValues,
          itemStyle: {
            color: CHART_COLOR_PALETTE[0],
          },
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            color: baseOption.textStyle.color,
          },
        },
      ],
      legend: undefined,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        formatter: (params: any) => {
          const param = params[0];
          const wallet = data.wallets[param.dataIndex];
          return formatItemTooltip(
            formatAddress(wallet.walletAddress),
            [
              { label: 'Winrate', value: `${param.value}%` },
              { label: 'Winning Trades', value: wallet.winningTrades.toString() },
              { label: 'Losing Trades', value: wallet.losingTrades.toString() },
              { label: 'Total Trades', value: wallet.totalTrades.toString() },
            ]
          );
        },
      },
    };
  }, [data, baseOption]);

  const distributionCharts = useMemo(() => {
    if (!isChartSuccess(data, 'wallets') || data.wallets.length === 0) return [];

    return data.wallets.map((wallet) => {
      const categories = wallet.winningDistribution.map(d => d.range);
      const winningCounts = wallet.winningDistribution.map(d => d.count);
      const losingCounts = wallet.losingDistribution.map(d => -d.count);

      const option: EChartsOption = {
        ...baseOption,
        title: wallet.walletAddress ? {
          text: formatAddress(wallet.walletAddress),
          left: 8,
          top: 8,
          textStyle: {
            color: baseOption.textStyle.color,
            fontSize: 16,
            fontWeight: 'bold',
          },
        } : undefined,
        grid: {
          left: '8%',
          right: '8%',
          bottom: '12%',
          top: '24%',
          containLabel: true,
        },
        xAxis: {
          ...baseOption.xAxis,
          type: 'category',
          data: categories,
          axisLabel: {
            ...baseOption.xAxis.axisLabel,
            interval: 0,
            rotate: 30,
          },
        },
        yAxis: {
          ...baseOption.yAxis,
          type: 'value',
          name: 'Trade Count',
          axisLabel: {
            ...baseOption.yAxis.axisLabel,
            formatter: (value: number) => Math.abs(value).toString(),
          },
        },
        series: [
          {
            name: 'Winning',
            type: 'bar',
            stack: 'total',
            data: winningCounts,
            itemStyle: {
              color: CHART_COLOR_PALETTE[1],
            },
          },
          {
            name: 'Losing',
            type: 'bar',
            stack: 'total',
            data: losingCounts,
            itemStyle: {
              color: CHART_COLOR_PALETTE[2],
            },
          },
        ],
        legend: {
          show: true,
          data: ['Winning', 'Losing'],
          textStyle: { color: baseOption.textStyle.color },
        },
        tooltip: {
          ...baseOption.tooltip,
          trigger: 'axis',
          axisPointer: {
            type: 'shadow',
          },
          formatter: (params: any) => {
            const winning = params.find((p: any) => p.seriesName === 'Winning');
            const losing = params.find((p: any) => p.seriesName === 'Losing');
            return `
              <div style="font-weight: 600; margin-bottom: 8px;">${params[0].name}</div>
              ${winning ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${CHART_COLOR_PALETTE[1]}">● Winning:</span><strong>${winning.value}</strong>
              </div>` : ''}
              ${losing ? `<div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: ${CHART_COLOR_PALETTE[2]}">● Losing:</span><strong>${Math.abs(losing.value)}</strong>
              </div>` : ''}
            `;
          },
        },
      };

      return {
        walletAddress: wallet.walletAddress,
        option,
      };
    });
  }, [data, baseOption]);

  const timeRangeOptions = WINRATE_TIME_RANGES.map(r => ({ value: r, label: r }));

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={!isChartSuccess(data, 'wallets') || data.wallets.length === 0}
      onRetry={() => refetch(false)}
      toolbarLayout="stacked"
      actions={
        <Layer style={{ width: 200 }}>
          <FilterSwitch
            options={timeRangeOptions}
            value={timeRange}
            onChange={(v) => setTimeRange(v as WinrateTimeRange)}
          />
        </Layer>
      }
    >
      <ChartContainer gap='0'>
        <ChartSection minHeight="300px">
          {overallWinrateOption && (
            <ChartGridItem minHeight={300}>
              <ReactECharts
                ref={overallChartRef}
                option={overallWinrateOption}
                style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                notMerge
                lazyUpdate
              />
            </ChartGridItem>
          )}
        </ChartSection>

        <ChartGrid itemCount={distributionCharts.length} autoFit minColumnWidth="400px">
          {distributionCharts.map((chart) => (
            <ChartGridItem
              key={chart.walletAddress}
              itemKey={chart.walletAddress}
              minHeight={300}
            >
              <ReactECharts
                option={chart.option}
                style={{ height: '100%', width: '100%' }}
                notMerge
                lazyUpdate
              />
            </ChartGridItem>
          ))}
        </ChartGrid>
      </ChartContainer>
    </ChartWrapper>
  );
}
