import { useMemo, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useStandardChartController } from '@/hooks/useChartController';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { SegmentedControl } from '../shared/ChartControls/SegmentedControl';
import { ChartWrapper } from '../shared';
import type { ChartProps } from '../shared/ChartProp';
import { useCarbonChartBaseOption, CHART_COLOR_PALETTE } from '@/util/carbon-chart-base';
import { useCarbonTokens } from '@/hooks/useCarbonToken';
import { cds } from '@/util/carbon-theme';
import {
  fetchTotalTradingVolume,
  fetchTradingVolumeDistribution,
  fetchTradingVolumePerTransaction,
} from '@/services/chart/chartApi';

interface VolumeComparisonWallet {
  walletAddress: string;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  tradingVolumePerTransaction: number;
  tradeCount: number;
}

interface TooltipParam {
  dataIndex: number;
}

interface VolumeComparisonResponse {
  wallets: VolumeComparisonWallet[];
  metadata: {
    period: string;
    currency: string;
    timestamp: number;
  };
}

async function fetchVolumeComparisonData(
  params?: { period?: string; wallets?: string }
): Promise<VolumeComparisonResponse> {
  const [totalVolRes, distRes, perTxRes] = await Promise.all([
    fetchTotalTradingVolume(params),
    fetchTradingVolumeDistribution(params),
    fetchTradingVolumePerTransaction(params),
  ]);

  const walletMap = new Map<string, VolumeComparisonWallet>();

  if (Array.isArray(totalVolRes.wallets)) {
    for (const w of totalVolRes.wallets) {
      const row = w as { wallet: string; tradingVolumeUsd?: number; tradeCount?: number };
      walletMap.set(row.wallet, {
        walletAddress: row.wallet,
        totalVolume: row.tradingVolumeUsd ?? 0,
        buyVolume: 0,
        sellVolume: 0,
        tradingVolumePerTransaction: 0,
        tradeCount: row.tradeCount ?? 0,
      });
    }
  }

  if (Array.isArray(perTxRes.wallets)) {
    for (const w of perTxRes.wallets) {
      const row = w as { wallet: string; tradingVolumePerTransaction?: number; transactionCount?: number };
      const existing = walletMap.get(row.wallet);
      if (existing) {
        existing.tradingVolumePerTransaction = row.tradingVolumePerTransaction ?? 0;
      } else {
        walletMap.set(row.wallet, {
          walletAddress: row.wallet,
          totalVolume: 0,
          buyVolume: 0,
          sellVolume: 0,
          tradingVolumePerTransaction: row.tradingVolumePerTransaction ?? 0,
          tradeCount: row.transactionCount ?? 0,
        });
      }
    }
  }

  if (Array.isArray(distRes.wallets)) {
    for (const w of distRes.wallets) {
      const existing = walletMap.get(w.walletAddress);
      if (existing) {
        existing.buyVolume = w.buyVolume ?? 0;
        existing.sellVolume = w.sellVolume ?? 0;
      } else {
        walletMap.set(w.walletAddress, {
          walletAddress: w.walletAddress,
          totalVolume: w.totalVolume ?? 0,
          buyVolume: w.buyVolume ?? 0,
          sellVolume: w.sellVolume ?? 0,
          tradingVolumePerTransaction: 0,
          tradeCount: 0,
        });
      }
    }
  }

  const wallets = Array.from(walletMap.values())
    .sort((a, b) => b.totalVolume - a.totalVolume);

  return {
    wallets,
    metadata: {
      period: params?.period ?? '30D',
      currency: 'USD',
      timestamp: Date.now(),
    },
  };
}

export function VolumeComparisonChart({
  title,
  minHeight = 400,
  initialFilters = { timePeriod: '30D', wallets: [] },
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
  actions,
}: ChartProps) {
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.volumeComparisonChart.title");
  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const tradeColors = useCarbonTokens({
    buy: cds.supportSuccess,
    sell: cds.supportError,
  });

  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString]
  );

  const { data, loadingState, refetch } = useStandardChartController<
    VolumeComparisonResponse,
    { period?: string; wallets?: string }
  >({
    fetcher: fetchVolumeComparisonData,
    query,
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled,
  });

  const chartOption = useMemo((): EChartsOption | null => {
    if (!data?.wallets?.length) return null;

    const wallets = data.wallets;
    const count = wallets.length;
    const categories = wallets.map(
      (w, i) => `#${i + 1} ${w.walletAddress.slice(0, 6)}...${w.walletAddress.slice(-4)}`
    );

    const allZeroVolume = wallets.every(
      w => w.totalVolume === 0 && w.buyVolume === 0 && w.sellVolume === 0
    );
    const allZeroPerTx = wallets.every(w => w.tradingVolumePerTransaction === 0);

    return {
      ...baseOption,
      legend: {
        show: true,
        textStyle: { color: baseOption.textStyle?.color },
        top: 0,
      },
      grid: {
        top: 40,
        bottom: 20,
        left: 70,
        right: 80,
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: 'category',
        data: categories,
        axisLabel: {
          ...baseOption.xAxis?.axisLabel,
          interval: 0,
          rotate: count > 5 ? 35 : 0,
          fontSize: 11,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: allZeroVolume ? 'value' : 'log',
          logBase: 10,
          min: allZeroVolume ? 0 : 1,
          name: tr("charts.volumeComparisonChart.totalVolume"),
          nameTextStyle: { color: baseOption.textStyle?.color },
          axisLabel: {
            show: true,
            formatter: (v: number) => fmt.num.compact.currency(v),
          },
          splitLine: {
            lineStyle: {
              color: baseOption.yAxis?.splitLine?.lineStyle?.color,
              type: 'dashed' as const,
            },
          },
        },
        {
          type: allZeroPerTx ? 'value' : 'log',
          logBase: 10,
          min: allZeroPerTx ? 0 : 1,
          name: tr("charts.volumeComparisonChart.volPerTx"),
          nameTextStyle: { color: baseOption.textStyle?.color },
          axisLabel: {
            show: true,
            formatter: (v: number) => fmt.num.compact.currency(v),
          },
          splitLine: { show: false },
        },
      ],
      series: [
        {
          name: tr("charts.volumeComparisonChart.totalVolume"),
          type: 'bar',
          data: wallets.map(w => w.totalVolume > 0 ? w.totalVolume : null),
          itemStyle: {
            color: CHART_COLOR_PALETTE[0],
            borderRadius: [2, 2, 0, 0],
          },
          barWidth: '18%',
          barGap: '8%',
          barCategoryGap: '30%',
          yAxisIndex: 0,
        },
        {
          name: tr("charts.volumeComparisonChart.buyVolume"),
          type: 'bar',
          data: wallets.map(w => w.buyVolume > 0 ? w.buyVolume : null),
          itemStyle: {
            color: tradeColors.buy || '#24a148',
            borderRadius: [2, 2, 0, 0],
          },
          barWidth: '18%',
          barGap: '8%',
          barCategoryGap: '30%',
          yAxisIndex: 0,
        },
        {
          name: tr("charts.volumeComparisonChart.sellVolume"),
          type: 'bar',
          data: wallets.map(w => w.sellVolume > 0 ? w.sellVolume : null),
          itemStyle: {
            color: tradeColors.sell || '#da1e28',
            borderRadius: [2, 2, 0, 0],
          },
          barWidth: '18%',
          barGap: '8%',
          barCategoryGap: '30%',
          yAxisIndex: 0,
        },
        {
          name: tr("charts.volumeComparisonChart.volPerTx"),
          type: 'bar',
          data: wallets.map(w => w.tradingVolumePerTransaction > 0 ? w.tradingVolumePerTransaction : null),
          itemStyle: {
            color: CHART_COLOR_PALETTE[2],
            borderRadius: [2, 2, 0, 0],
          },
          barWidth: '18%',
          barGap: '8%',
          barCategoryGap: '30%',
          yAxisIndex: 1,
        },
      ],
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const tooltipParams = Array.isArray(params) ? (params as TooltipParam[]) : [];
          if (tooltipParams.length === 0) return '';
          const idx = tooltipParams[0].dataIndex;
          const w = wallets[idx];
          if (!w) return '';
          const header = `<div style="font-weight:600;margin-bottom:4px">#${idx + 1} ${w.walletAddress.slice(0, 8)}...${w.walletAddress.slice(-4)}</div>`;
          const rows = [
            { label: tr("charts.volumeComparisonChart.totalVolume"), value: fmt.num.compact.currency(w.totalVolume) },
            { label: tr("charts.volumeComparisonChart.buyVolume"), value: fmt.num.compact.currency(w.buyVolume) },
            { label: tr("charts.volumeComparisonChart.sellVolume"), value: fmt.num.compact.currency(w.sellVolume) },
            { label: tr("charts.volumeComparisonChart.volPerTx"), value: fmt.num.compact.currency(w.tradingVolumePerTransaction) },
            { label: tr("charts.volumeComparisonChart.trades"), value: fmt.num.decimal(w.tradeCount) },
          ];
          const tableRows = rows.map(r => `<tr><td style="text-align:left;padding-right:16px">${r.label}</td><td style="text-align:right">${r.value}</td></tr>`).join('');
          return header + `<table style="width:100%">${tableRows}</table>`;
        },
      },
    };
  }, [data, baseOption, fmt, tradeColors, tr]);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      className={className}
      isEmpty={!data?.wallets?.length}
      onRetry={() => refetch(false)}
      // toolbarLayout="stacked"
      actions={
        <>
          {actions}
          <SegmentedControl
            options={[
              { value: '24H', label: '24H' },
              { value: '7D', label: '7D' },
              { value: '30D', label: '30D' },
              { value: '90D', label: '90D' },
            ]}
            value={filters.timePeriod}
            onChange={(v) => setTimePeriod(v)}
            ariaLabel={tr("charts.timePeriod")}
          />
        </>
      }
    >
      {chartOption && (
        <ReactECharts
          ref={chartRef}
          option={chartOption}
          style={{
            height: '100%',
            width: '100%',
            minHeight: `${minHeight}px`,
          }}
          notMerge
          lazyUpdate
        />
      )}
    </ChartWrapper>
  );
}
