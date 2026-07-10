import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { EChartsInstance } from '@/util/echarts-setup';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { PeriodSelector } from '@/components/common/PeriodSelector/PeriodSelector';
import { useCarbonChartBaseOption } from '@/util/carbon-chart-base';
import { useCarbonTokens } from '@/hooks/useCarbonToken';
import { cds } from '@/util/carbon-theme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchTradingVolumeDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { isChartSuccess } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import type { TradingVolumeDistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper, ChartGrid, ChartGridItem } from '@/components/charts/shared';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartProps } from '../shared/ChartProp';
import { runChartExport } from '@/services/chart/chartExportService';

type TradingVolumeDistributionData = InferFetcherData<typeof fetchTradingVolumeDistribution>;
const DEFAULT_BUY_COLOR = '#24a148';
const DEFAULT_SELL_COLOR = '#da1e28';

type TradingVolumeWallet = {
  wallet?: string;
  walletAddress: string;
  buyVolume?: number;
  sellVolume?: number;
  totalVolume?: number;
};

type PieTooltipParam = {
  name: string;
  value?: unknown;
  data: { percentage: number };
};

export const TradingVolumeDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
  actions,
}) => {
  const { tr, fmt } = useLocalization();
  const chartTitle = tr('charts.tradingVolumeDistributionChart.title');
  const buyLabel = tr('charts.tradingVolumeDistributionChart.buy');
  const sellLabel = tr('charts.tradingVolumeDistributionChart.sell');

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const tradeColors = useCarbonTokens({
    buy: cds.supportSuccess,
    sell: cds.supportError,
  });
  const { selectedTimezone: timezone } = useChartContext();

  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<TradingVolumeDistributionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString]
  );

  const { data, loadingState, refetch } =
    useStandardChartController<TradingVolumeDistributionData, TradingVolumeDistributionRequestParams>({
      fetcher: fetchTradingVolumeDistribution,
      query,
      autoRefresh,
      refreshInterval,
      enabled: fetchEnabled,
    });

  const { exportPNG, exportSVG, exportPDF, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: 'trading-volume-distribution',
  });

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!isChartSuccess(data, 'wallets')) return;
      if (!data.wallets || !Array.isArray(data.wallets) || data.wallets.length === 0) return;

      const instance = chartRef.current?.getEchartsInstance() ?? null;
      const csv: ChartDataSeries[] = [];

      if (data.wallets && Array.isArray(data.wallets)) {
        data.wallets.forEach((wallet: TradingVolumeWallet) => {
          const buy = wallet.buyVolume ?? 0;
          const sell = wallet.sellVolume ?? 0;
          csv.push({
            id: `trading-volume-distribution-${wallet.wallet}`,
            name: `Trading Volume Distribution - ${wallet.wallet}`,
            type: 'pie',
            visible: true,
            data: [
              { name: buyLabel, value: buy },
              { name: sellLabel, value: sell },
            ],
          });
        });
      }

      await runChartExport(
        {
          format,
          filters,
          chartInstance: instance as EChartsInstance | null,
          csvData: csv,
        },
        { exportPNG, exportSVG, exportPDF, exportCSV }
      );
    },
    [data, filters, exportPNG, exportSVG, exportPDF, exportCSV]
  );

  const createChartOption = useCallback((
    distributionData: { name: string; value: number; percentage: number; color?: string }[],
    total: number,
    walletLabel?: string,
    isMultiWallet?: boolean
  ): EChartsOption => {
    const filteredData = isMultiWallet && selectedAssets.size > 0
      ? distributionData.filter(a => selectedAssets.has(a.name))
      : distributionData;

    const filteredTotal = filteredData.reduce((sum, a) => sum + a.value, 0);
    const dataWithRecalculatedPercentages = filteredData.map(a => ({
      ...a,
      percentage: filteredTotal > 0 ? (a.value / filteredTotal) * 100 : 0,
    }));

    return {
      ...baseOption,
      xAxis: undefined,
      yAxis: undefined,
      title: walletLabel ? {
        text: walletLabel,
        left: 8,
        top: 8,
        textStyle: {
          color: baseOption.textStyle.color,
          fontSize: 16,
          fontWeight: 'bold',
        },
      } : undefined,
      tooltip: {
        ...baseOption.tooltip,
        trigger: 'item',
        formatter: (param: unknown) => {
          const p = param as PieTooltipParam;
          return createTooltipHeader(p.name)
            + createTooltipRow(
              tr('charts.tradingVolumeDistributionChart.volume'),
              fmt.num.compact.currency(Number(p.value ?? 0))
            )
            + createTooltipRow(
              tr('charts.tradingVolumeDistributionChart.percentage'),
              `${p.data.percentage.toFixed(2)}%`
            );
        },
      },
      legend: {
        show: true,
        data: distributionData.map(d => d.name),
        textStyle: { color: baseOption.textStyle.color },
      },
      series: [
        {
          type: 'pie',
          radius: ['22%', '48%'],
          center: ['50%', '50%'],
          data: dataWithRecalculatedPercentages.map((a) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            itemStyle: {
              color: a.color,
              borderColor: baseOption.backgroundColor as string,
              borderWidth: 2,
              borderRadius: 6,
            },
          })),
          label: {
            formatter: (param: unknown) => { const p = param as PieTooltipParam; return `${p.name}\n${p.data.percentage.toFixed(1)}%`; },
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
            text: tr('charts.tradingVolumeDistributionChart.totalVolume'),
            fill: baseOption.textStyle.color,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '50%',
          style: {
            text: fmt.num.compact.currency(isMultiWallet && selectedAssets.size > 0 ? filteredTotal : total),
            fill: baseOption.textStyle.color,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [baseOption, tr, selectedAssets, fmt]);

  const aggregatedLegendData = useMemo(() => {
    if (!data || !data.wallets || !Array.isArray(data.wallets) || data.wallets.length <= 1) return null;
    const buyColor = tradeColors.buy || DEFAULT_BUY_COLOR;
    const sellColor = tradeColors.sell || DEFAULT_SELL_COLOR;

    return [
      {
        name: buyLabel,
        color: buyColor,
      },
      {
        name: sellLabel,
        color: sellColor,
      },
    ];
  }, [data, buyLabel, sellLabel, tradeColors]);

  useEffect(() => {
    if (aggregatedLegendData) {
      setSelectedAssets(new Set(aggregatedLegendData.map(a => a.name)));
    }
  }, [aggregatedLegendData]);

  const toggleAssetSelection = useCallback((assetName: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetName)) {
        if (newSet.size > 1) {
          newSet.delete(assetName);
        }
      } else {
        newSet.add(assetName);
      }
      return newSet;
    });
  }, []);

  const chartOptions = useMemo(() => {
    if (!data || !data.wallets || !Array.isArray(data.wallets) || data.wallets.length === 0 || (data.wallets as unknown as { error?: unknown }).error) return [];

    const isMultiWallet = data.wallets.length > 1;

    return data.wallets.map((wallet) => {
      const buy = wallet.buyVolume ?? 0;
      const sell = wallet.sellVolume ?? 0;
      const total = wallet.totalVolume ?? (buy + sell);
      const buyColor = tradeColors.buy || DEFAULT_BUY_COLOR;
      const sellColor = tradeColors.sell || DEFAULT_SELL_COLOR;
      const pieData = [
        { name: buyLabel, value: buy, percentage: total > 0 ? (buy / total) * 100 : 0, color: buyColor },
        { name: sellLabel, value: sell, percentage: total > 0 ? (sell / total) * 100 : 0, color: sellColor },
      ];
      return {
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          pieData,
          total,
          `${wallet.walletAddress.slice(0, 8)}...`,
          isMultiWallet
        ),
      };
    });
  }, [data, createChartOption, buyLabel, sellLabel, tradeColors]);

  const isEmpty = !isChartSuccess(data, 'wallets') || data.wallets.length === 0 || (filters.wallets && filters.wallets.length === 0);

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={filters.wallets && filters.wallets.length === 0
        ? {
          title: tr('charts.tradingVolumeDistributionChart.noWalletsTitle'),
          message: tr('charts.tradingVolumeDistributionChart.noWalletsMessage'),
        }
        : undefined}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
      actions={actions}
    >
      <div data-html2canvas-ignore="true" style={{ padding: '0.5rem' }}>
        <PeriodSelector value={filters.timePeriod} onChange={(k) => setTimePeriod(k)} compact />
      </div>

      {chartOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {aggregatedLegendData && chartOptions.length > 1 && (
            <div
              data-html2canvas-ignore="true"
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
                        opacity: isSelected ? 1 : 0.5,
                      }}
                    />
                    <span style={{ fontSize: '14px', color: baseOption.textStyle.color }}>
                      {asset.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <ChartGrid itemCount={chartOptions.length} multiItemColumns={3}>
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
                aspectRatio="1"
              >
                <ReactECharts
                  ref={index === 0 ? chartRef : undefined}
                  option={chartData.option}
                  style={{ height: '100%', width: '100%', minHeight: `${minHeight}px` }}
                  notMerge
                  lazyUpdate
                />
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </ChartWrapper>
  );
};



