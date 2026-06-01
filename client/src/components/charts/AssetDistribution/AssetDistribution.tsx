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
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from '@/util/carbon-chart-base';
import { useCarbonTokens } from '@/hooks/useCarbonToken';
import { cds } from '@/util/carbon-theme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import type { DistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper, ChartGrid, ChartGridItem } from '@/components/charts/shared';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartProps } from '../shared/ChartProp';
import { runChartExport } from '@/services/chart/chartExportService';
import { Dropdown, FilterableMultiSelect, Layer } from '@carbon/react';
import { SettingsAdjust } from '@carbon/icons-react';


// ── Types ─────────────────────────────────────────────────────────────────
type TopNOption = 5 | 10 | 0; // 0 = All
type MinPctOption = 0 | 1 | 5 | 10;
const MAX_VISIBLE_OTHERS = 10;

interface LegendAsset {
  name: string;
  color: string;
}

interface AssetItem {
  name: string;
  value: number;
  percentage: number;
  color?: string;
  /** Logo image URL from enriched backend metadata – undefined when unavailable */
  logoUri?: string;
}

// ── Grouping helper ────────────────────────────────────────────────────────
/**
 * Apply Top-N and min-percentage grouping to a raw asset list.
 * Items that don't make the cut are merged into a single "Others" entry
 * that carries the list of hidden names so the tooltip can show them.
 */
function applyGrouping(
  raw: AssetItem[],
  topN: TopNOption,
  minPct: MinPctOption,
  othersLabel: string,
): (AssetItem & { hiddenNames?: string[] })[] {
  if (raw.length === 0) return [];

  // Recalculate percentages against the raw total so they're always fresh
  const rawTotal = raw.reduce((s, a) => s + a.value, 0);
  const withPct = raw
    .map(a => ({ ...a, percentage: rawTotal > 0 ? (a.value / rawTotal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value); // descending by value

  // Step 1: apply min-% filter
  const afterMinPct = minPct > 0
    ? withPct.filter(a => a.percentage >= minPct)
    : withPct;

  // Step 2: apply Top-N cap
  const kept = topN > 0 ? afterMinPct.slice(0, topN) : afterMinPct;

  // Collect everything that was cut in either step
  const keptSet = new Set(kept.map(a => a.name));
  const hidden = withPct.filter(a => !keptSet.has(a.name));

  if (hidden.length === 0) return kept;

  const othersValue = hidden.reduce((s, a) => s + a.value, 0);
  const newTotal = kept.reduce((s, a) => s + a.value, 0) + othersValue;

  // Recalculate percentages for the kept items
  const recalcKept = kept.map(a => ({
    ...a,
    percentage: newTotal > 0 ? (a.value / newTotal) * 100 : 0,
  }));

  const othersItem = {
    name: othersLabel,
    value: othersValue,
    percentage: newTotal > 0 ? (othersValue / newTotal) * 100 : 0,
    hiddenNames: hidden.map(a => a.name),
  };

  return [...recalcKept, othersItem];
}

// Infer the response type from the fetcher function automatically
type AssetDistributionData = InferFetcherData<typeof fetchAssetDistribution>;

export const AssetDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
}) => {
  const { tr, fmt } = useLocalization();
  const chartTitle = tr('charts.assetDistributionChart.title');
  const othersLabel = tr('charts.assetDistributionChart.others');

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const tokens = useCarbonTokens({
    background: cds.background,
    layer: cds.layer01,
    borderSubtle: cds.borderSubtle01,
    textPrimary: cds.textPrimary,
    textSecondary: cds.textSecondary,
  });
  const { selectedTimezone: timezone } = useChartContext();

  // Track selected assets for legend filtering
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // ── New grouping filters ───────────────────────────────────────────────
  const [topN, setTopN] = useState<TopNOption>(5);       // default: Top 5
  const [minPct, setMinPct] = useState<MinPctOption>(0); // 0 = no min

  // Use centralized filter sync hook
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
   * Centralized lifecycle handling
   */
  const { data, loadingState, refetch } =
    useStandardChartController<AssetDistributionData, DistributionRequestParams>({
      fetcher: fetchAssetDistribution,
      query,
      autoRefresh,
      refreshInterval,
      enabled: fetchEnabled,
    });

  /**
   * Setup chart export
   */
  const { exportPNG, exportSVG, exportPDF, exportCSV } = useChartExport({
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
      const csv: ChartDataSeries[] = [];

      if ('wallets' in data && data.wallets) {
        data.wallets.forEach((wallet) => {
          const grouped = applyGrouping(wallet.data as AssetItem[], topN, minPct, othersLabel);
          csv.push({
            id: `asset-distribution-${wallet.walletAddress}`,
            name: `${tr('charts.assetDistributionChart.export.name')} - ${wallet.walletAddress}`,
            type: 'pie',
            visible: true,
            data: grouped.map((a) => ({
              name: a.name,
              value: a.value,
            })),
          });
        });
      } else if ('data' in data && data.data) {
        const grouped = applyGrouping(data.data as AssetItem[], topN, minPct, othersLabel);
        csv.push({
          id: 'asset-distribution',
          name: tr('charts.assetDistributionChart.export.name'),
          type: 'pie',
          visible: true,
          data: grouped.map((a) => ({
            name: a.name,
            value: a.value,
          })),
        });
      }

      await runChartExport(
        {
          format,
          filters,
          chartInstance: instance as any,
          csvData: csv,
          csvFilters: { ...filters, wallets: [] },
          extraFilters: {
            [tr('charts.assetDistributionChart.filters.topN')]: topN === 0 ? tr('charts.assetDistributionChart.filters.all') : `${tr('charts.assetDistributionChart.filters.top')} ${topN}`,
            [tr('charts.assetDistributionChart.filters.minPct')]: minPct === 0 ? tr('charts.assetDistributionChart.filters.all') : `>${minPct}%`,
          },
        },
        { exportPNG, exportSVG, exportPDF, exportCSV }
      );
    },
    [data, filters, topN, minPct, othersLabel, exportPNG, exportSVG, exportPDF, exportCSV]
  );

  /**
   * Helper to create chart option for a single distribution dataset
   */
  const createChartOption = useCallback((
    distributionData: { name: string; value: number; percentage: number; color?: string }[],
    walletLabel?: string,
    isMultiWallet?: boolean
  ): EChartsOption => {
    const preGrouped = isMultiWallet && selectedAssets.size > 0
      ? distributionData.filter(a => selectedAssets.has(a.name))
      : distributionData;

    const grouped = applyGrouping(preGrouped as AssetItem[], topN, minPct, othersLabel);

    const displayTotal = grouped.reduce((s, a) => s + a.value, 0);
    const tooltipBackground = tokens.layer || cds.layer01;
    const tooltipBorder = tokens.borderSubtle || cds.borderSubtle01;
    const tooltipText = tokens.textPrimary || cds.textPrimary;
    const tooltipSecondaryText = tokens.textSecondary || cds.textSecondary;

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
        appendToBody: true,
        confine: true,
        backgroundColor: tooltipBackground,
        borderColor: tooltipBorder,
        borderWidth: 1,
        extraCssText: 'box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16); max-width: 260px; z-index: 10000;',
        textStyle: { color: tooltipText, fontSize: 12 },
        formatter: (p: any) => {
          const isOthers = p.name === othersLabel;
          const logoUri: string | undefined = p.data.logoUri;
          const logoHtml = logoUri
            ? `<img src="${logoUri}" alt="${p.name}" width="16" height="16" style="border-radius:50%;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none'">`
            : '';
          let html = createTooltipHeader(`${logoHtml}${p.name}`);
          if (isOthers && p.data.hiddenNames?.length > 0) {
            const hiddenNames = p.data.hiddenNames as string[];
            const visibleHiddenNames = hiddenNames.slice(0, MAX_VISIBLE_OTHERS);
            const hiddenSummary = hiddenNames.length > MAX_VISIBLE_OTHERS
              ? `${tr('charts.assetDistributionChart.filters.top')} ${MAX_VISIBLE_OTHERS} / ${hiddenNames.length}`
              : `${hiddenNames.length}`;
            html += `<div style="margin-bottom:8px;padding-top:2px;">`;
            html += `<div style="padding-bottom:3px;font-size:11px;font-weight:600;color:${tooltipText}">${hiddenSummary}</div>`;
            html += visibleHiddenNames
              .map((n, index) => `<div style="padding:1px 0;font-size:11px;line-height:1.35;color:${tooltipSecondaryText}">${index + 1}. ${n}</div>`)
              .join('');
            if (hiddenNames.length > MAX_VISIBLE_OTHERS) {
              html += `<div style="padding:2px 0 0;font-size:11px;line-height:1.35;color:${tooltipSecondaryText}">...</div>`;
            }
            html += `</div>`;
          }
          html += createTooltipRow(
            tr('charts.assetDistributionChart.value'),
            fmt.num.compact.currency(Number(p.value ?? 0))
          );
          html += createTooltipRow(
            tr('charts.assetDistributionChart.percentage'),
            `${p.data.percentage.toFixed(2)}%`
          );
          return html;
        },
      },
      // legend: {
      //   show: !isMultiWallet,
      //   orient: 'horizontal',
      //   bottom: 0,
      //   left: 'center',
      //   data: grouped.map(d => d.name),
      //   icon: 'circle',
      //   textStyle: { color: baseOption.textStyle.color, fontSize: 12 },
      //   tooltip: {
      //     show: true,
      //     formatter: (params: any) => {
      //       const name = params.name ?? params;
      //       const item = grouped.find(g => g.name === name);
      //       const hidden: string[] = (item as any)?.hiddenNames ?? [];
      //       if (name !== othersLabel || hidden.length === 0) return name;
      //       return (
      //         `<strong>${name}</strong><br/>` +
      //         hidden.map(n => `• ${n}`).join('<br/>')
      //       );
      //     },
      //   } as any,
      // },
      legend: { show: false },
      series: [
        {
          type: 'pie',
          radius: ['50%', '76%'],
          center: ['50%', '50%'],
          data: grouped.map((a, i) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            hiddenNames: (a as any).hiddenNames,
            logoUri: (a as AssetItem).logoUri,
            itemStyle: {
              color:
                a.name === othersLabel
                  ? '#6f6f6f'
                  : (a as any).color ??
                  CHART_COLOR_PALETTE[i % CHART_COLOR_PALETTE.length],
              borderColor: '#ffffff',
              borderWidth: 2,
              borderRadius: 6,
            },
          })),
          label: {
            formatter: (p: any) => `${p.name}\n${p.data.percentage.toFixed(1)}%`,
            color: baseOption.textStyle.color,
            fontSize: 11,
          },
        },
      ],
      graphic: [
        // {
        //   type: 'text',
        //   left: 'center',
        //   top: '46%',
        //   style: {
        //     text: tr('charts.assetDistributionChart.totalValue'),
        //     fill: baseOption.textStyle.color,
        //     fontSize: 14,
        //     opacity: 0.7,
        //   },
        // },
        {
          type: 'text',
          left: 'center',
          top: '46%',
          style: {
            text: fmt.num.compact.currency(displayTotal),
            fill: baseOption.textStyle.color,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [baseOption, tokens, tr, selectedAssets, topN, minPct, othersLabel, fmt]);

  /**
   * Extract unique assets across all wallets for aggregated legend
   */
  const aggregatedLegendData = useMemo(() => {
    if (!data || !('wallets' in data) || !data.wallets || data.wallets.length <= 1) return null;

    const uniqueAssets = new Map<string, LegendAsset>();

    data.wallets.forEach((wallet: any, walletIndex: number) => {
      wallet.data.forEach((asset: any, assetIndex: number) => {
        if (!uniqueAssets.has(asset.name)) {
          uniqueAssets.set(asset.name, {
            name: asset.name,
            color: (asset as any).color ?? CHART_COLOR_PALETTE[assetIndex % CHART_COLOR_PALETTE.length],
          });
        }
      });
    });

    return Array.from(uniqueAssets.values());
  }, [data]);

  useEffect(() => {
    if (!aggregatedLegendData || selectedAssets.size === 0) return;

    const availableAssets = new Set(aggregatedLegendData.map(asset => asset.name));
    const nextSelectedAssets = new Set(
      Array.from(selectedAssets).filter(assetName => availableAssets.has(assetName))
    );

    if (nextSelectedAssets.size !== selectedAssets.size) {
      setSelectedAssets(nextSelectedAssets);
    }
  }, [aggregatedLegendData, selectedAssets]);

  const selectedLegendItems = useMemo(() => {
    if (!aggregatedLegendData) return [];
    return aggregatedLegendData.filter(asset => selectedAssets.has(asset.name));
  }, [aggregatedLegendData, selectedAssets]);

  /**
   * ECharts options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!data) return [];

    const isMultiWallet = 'wallets' in data && data.wallets && data.wallets.length > 1;

    if ('wallets' in data && data.wallets && data.wallets.length > 0) {
      return data.wallets.map((wallet) => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.data,
          data.wallets.length > 1 ? `${wallet.walletAddress.slice(0, 8)}...` : undefined,
          isMultiWallet
        ),
      }));
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty = !data || (
    (!('wallets' in data) || !data.wallets || data.wallets.length === 0) &&
    // (!('data' in data) || !data.data || data.data.length === 0)
    (!('wallets' in data) || !data.wallets || data.wallets.length === 0)
  ) || (filters.wallets && filters.wallets.length === 0);

  const topNOptions: Array<{ value: TopNOption; label: string }> = [
    { value: 5, label: tr('charts.assetDistributionChart.filters.top5') },
    { value: 10, label: tr('charts.assetDistributionChart.filters.top10') },
    { value: 0, label: tr('charts.assetDistributionChart.filters.all') },
  ];

  const minPctOptions: Array<{ value: MinPctOption; label: string }> = [
    { value: 0, label: tr('charts.assetDistributionChart.filters.allPercent') },
    { value: 1, label: tr('charts.assetDistributionChart.filters.minPct1') },
    { value: 5, label: tr('charts.assetDistributionChart.filters.minPct5') },
    { value: 10, label: tr('charts.assetDistributionChart.filters.minPct10') },
  ];

  const filterControls = (
    <FilterMenu
      topN={topN}
      minPct={minPct}
      setTopN={setTopN}
      setMinPct={setMinPct}
      topNOptions={topNOptions}
      minPctOptions={minPctOptions}
    />
  );

  return (
    <ChartWrapper
      title={chartTitle}
      // toolbarLayout="stacked"
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={filters.wallets && filters.wallets.length === 0
        ? {
          title: tr('charts.noWalletsTitle'),
          message: tr('charts.assetDistributionChart.noWalletsMessage'),
        }
        : undefined}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
      wrapperMinHeight={minHeight}
      actions={filterControls}
      enableExport={false}
      enableFullscreen={false}
      enableMiniPlayer={false}
    >
      {chartOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Token selector for Multi-Wallet View */}
          {aggregatedLegendData && chartOptions.length > 1 && (
            <div
              data-html2canvas-ignore="true"
              style={{
                display: 'flex',
                justifyContent: 'flex-start',
                padding: '1rem 0',
                borderBottom: '1px solid var(--cds-border-subtle)',
                marginBottom: '1rem',
              }}
            >
              <Layer style={{ width: 'min(100%, 360px)' }}>
                <FilterableMultiSelect<LegendAsset>
                  id="asset-distribution-token-selector"
                  titleText={tr('charts.balanceChart.selectTokenLabel')}
                  placeholder={tr('charts.allTokens')}
                  items={aggregatedLegendData}
                  selectedItems={selectedLegendItems}
                  itemToString={(asset) => asset?.name ?? ''}
                  itemToElement={(asset) => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minWidth: 0 }}>
                      <span
                        aria-hidden="true"
                        style={{
                          width: 10,
                          height: 10,
                          flex: '0 0 10px',
                          borderRadius: '50%',
                          backgroundColor: asset.color,
                        }}
                      />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</span>
                    </span>
                  )}
                  selectionFeedback="fixed"
                  size="lg"
                  onChange={({ selectedItems }) => {
                    setSelectedAssets(new Set(selectedItems.map(asset => asset.name)));
                  }}
                />
              </Layer>
            </div>
          )}

          {/* Chart Grid */}
          <ChartGrid
            itemCount={chartOptions.length}
            multiItemColumns={Math.min(3, chartOptions.length)}
          >
            {chartOptions.map((chartData: any, index: number) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
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

const TRIGGER_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
  border: '1px solid var(--cds-border-subtle)',
  borderRadius: 4,
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--cds-text-primary)',
};

const MENU_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: 'calc(100% + 4px)',
  minWidth: 220,
  background: 'var(--cds-layer)',
  border: '1px solid var(--cds-border-subtle)',
  borderRadius: 8,
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  zIndex: 100,
  padding: 12,
};

function FilterMenu({
  topN,
  minPct,
  setTopN,
  setMinPct,
  topNOptions,
  minPctOptions,
}: {
  topN: TopNOption;
  minPct: MinPctOption;
  setTopN: (v: TopNOption) => void;
  setMinPct: (v: MinPctOption) => void;
  topNOptions: Array<{ value: TopNOption; label: string }>;
  minPctOptions: Array<{ value: MinPctOption; label: string }>;
}) {
  const { tr } = useLocalization();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current && btnRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        aria-label={tr('charts.assetDistributionChart.filtersMenu')}
        aria-haspopup="menu"
        aria-expanded={open}
        title={tr('charts.assetDistributionChart.filtersMenu')}
        style={TRIGGER_STYLE}
      >
        <SettingsAdjust size={20} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus(); }
          }}
          style={MENU_STYLE}
        >
          <Dropdown
            id="asset-dist-topn"
            titleText={tr('charts.assetDistributionChart.filters.topN')}
            label={tr('charts.assetDistributionChart.filters.topN')}
            items={topNOptions}
            itemToString={(item) => item?.label ?? ''}
            selectedItem={topNOptions.find(o => o.value === topN)}
            onChange={({ selectedItem }) => {
              if (selectedItem) setTopN(selectedItem.value as TopNOption);
            }}
            size="sm"
          />
          <div style={{ height: 12 }} />
          <Dropdown
            id="asset-dist-minpct"
            titleText={tr('charts.assetDistributionChart.filters.minPct')}
            label={tr('charts.assetDistributionChart.filters.minPct')}
            items={minPctOptions}
            itemToString={(item) => item?.label ?? ''}
            selectedItem={minPctOptions.find(o => o.value === minPct)}
            onChange={({ selectedItem }) => {
              if (selectedItem) setMinPct(selectedItem.value as MinPctOption);
            }}
            size="sm"
          />
        </div>
      )}
    </div>
  );
}

