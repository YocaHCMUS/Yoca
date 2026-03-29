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
import sharedChartStyles from '../shared/ChartStyle.module.scss';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartFiltersSync } from '@/hooks/useChartFiltersSync';
import { useChartTheme, getThemedChartBaseOption } from '@/hooks/useChartTheme';
import { useChartContext } from '@/contexts/ChartContext';
import { fetchAssetDistribution, type InferFetcherData } from '@/services/chart/chartApi';
import { formatCurrency } from '@/util/chart-helpers';
import { createTooltipHeader, createTooltipRow } from '@/util/tooltip-helpers';
import { getPieLegend } from '@/util/chart-legend-config';
import type { DistributionRequestParams } from '@/types/chart-api.types';
import { useStandardChartController } from '@/hooks/useChartController';
import { ChartWrapper, ChartGrid, ChartGridItem } from '@/components/charts/shared';
import { useChartExport } from '@/hooks/useChartExport';
import type { ExportFormat } from '@/types/chart-filters.types';
import type { ChartDataSeries } from '@/types/chart-data.types';
import type { ChartProps } from '../shared/ChartProp';
import { runChartExport } from '@/services/chart/chartExportService';


// ── Types ─────────────────────────────────────────────────────────────────
type TopNOption = 5 | 10 | 0; // 0 = All
type MinPctOption = 0 | 1 | 5 | 10;

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

// export interface AssetDistributionProps {
//   minHeight?: number;
//   initialFilters?: Partial<any>;
//   autoRefresh?: boolean;
//   refreshInterval?: number;
//   className?: string;
// }

function getWindowDaysFromPeriod(timePeriod?: string): 7 | 30 {
  return timePeriod?.toUpperCase() === '7D' ? 7 : 30;
}

export const AssetDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  className,
  loadOnInteractionOnly = false,
}) => {
  const { tr } = useLocalization();
  const chartTitle = tr('charts.assetDistributionChart.title');
  const othersLabel = tr('charts.assetDistributionChart.others');

  const chartRef = useRef<ReactECharts>(null);
  const chartTheme = useChartTheme();
  const { selectedTimezone: timezone } = useChartContext();

  // Track selected assets for legend filtering
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());

  // ── New grouping filters ───────────────────────────────────────────────
  const [topN, setTopN] = useState<TopNOption>(5);       // default: Top 5
  const [minPct, setMinPct] = useState<MinPctOption>(0); // 0 = no min

  // Use centralized filter sync hook
  const { filters, walletsString, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const [interactionLoadCount, setInteractionLoadCount] = useState(0);
  const [chartWindowDays, setChartWindowDays] = useState<7 | 30>(() =>
    getWindowDaysFromPeriod(initialFilters?.timePeriod),
  );

  const effectiveAutoRefresh = loadOnInteractionOnly ? false : autoRefresh;

  useEffect(() => {
    if (!loadOnInteractionOnly) {
      return;
    }
    setInteractionLoadCount(0);
  }, [walletsString, loadOnInteractionOnly]);

  useEffect(() => {
    setChartWindowDays(getWindowDaysFromPeriod(filters.timePeriod));
  }, [filters.timePeriod]);

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
      fetchMode: loadOnInteractionOnly ? "manual" : "auto",
      autoRefresh: effectiveAutoRefresh,
      refreshInterval,
    });

  useEffect(() => {
    if (!loadOnInteractionOnly || interactionLoadCount === 0) {
      return;
    }
    void refetch(true);
  }, [interactionLoadCount, loadOnInteractionOnly, refetch]);

  const handleWindowRangeClick = (days: 7 | 30) => {
    const period = days === 7 ? "7D" : "30D";
    setChartWindowDays(days);
    setTimePeriod(period);
    setInteractionLoadCount((c) => c + 1);
  };

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
        data.wallets.forEach((wallet: any) => {
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
    total: number,
    walletLabel?: string,
    isMultiWallet?: boolean
  ): EChartsOption => {
    const base = getThemedChartBaseOption(chartTheme);

    // Filter data based on selected assets in multi-wallet view
    const preGrouped = isMultiWallet && selectedAssets.size > 0
      ? distributionData.filter(a => selectedAssets.has(a.name))
      : distributionData;

    // Apply Top-N and min-% grouping
    const grouped = applyGrouping(preGrouped as AssetItem[], topN, minPct, othersLabel);

    // Total used for the centre label: sum of grouped data
    const displayTotal = grouped.reduce((s, a) => s + a.value, 0);

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
        formatter: (p: any) => {
          const isOthers = p.name === othersLabel;
          const logoUri: string | undefined = p.data.logoUri;
          // Build header: optional logo image followed by the token name
          const logoHtml = logoUri
            ? `<img src="${logoUri}" alt="${p.name}" width="16" height="16" style="border-radius:50%;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none'">`
            : '';
          let html = createTooltipHeader(`${logoHtml}${p.name}`);
          if (isOthers && p.data.hiddenNames?.length > 0) {
            html += `<div style="max-height:160px;overflow-y:auto;margin-bottom:4px;">`;
            html += (p.data.hiddenNames as string[])
              .map(n => `<div style="padding:1px 0;font-size:11px;color:var(--cds-text-secondary)">• ${n}</div>`)
              .join('');
            html += `</div>`;
          }
          html += createTooltipRow(
            tr('charts.assetDistributionChart.value'),
            formatCurrency(p.value)
          );
          html += createTooltipRow(
            tr('charts.assetDistributionChart.percentage'),
            `${p.data.percentage.toFixed(2)}%`
          );
          return html;
        },
      },
      legend: {
        ...getPieLegend(
          chartTheme,
          grouped.map(d => d.name),
          !isMultiWallet
        ),
        // ECharts 5: show a tooltip when hovering a legend item.
        // For "Others" we list the constituent token names.
        tooltip: {
          show: true,
          formatter: (name: string) => {
            const item = grouped.find(g => g.name === name);
            const hidden: string[] = (item as any)?.hiddenNames ?? [];
            if (name !== othersLabel || hidden.length === 0) return name;
            return (
              `<strong>${name}</strong><br/>` +
              hidden.map(n => `• ${n}`).join('<br/>')
            );
          },
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['26%', '56%'],
          center: ['50%', '50%'],
          data: grouped.map((a, i) => ({
            name: a.name,
            value: a.value,
            percentage: a.percentage,
            hiddenNames: (a as any).hiddenNames,
            // Forward logoUri so the tooltip formatter can render it
            logoUri: (a as AssetItem).logoUri,
            itemStyle: {
              color:
                a.name === othersLabel
                  ? chartTheme.textColorSecondary   // neutral grey for Others
                  : (a as any).color ??
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
            text: tr('charts.assetDistributionChart.totalValue'),
            fill: chartTheme.textColorSecondary,
            fontSize: 14,
          },
        },
        {
          type: 'text',
          left: 'center',
          top: '50%',
          style: {
            text: formatCurrency(displayTotal),
            fill: chartTheme.textColor,
            fontSize: 18,
            fontWeight: 'bold',
          },
        },
      ],
    };
  }, [chartTheme, tr, selectedAssets, topN, minPct]);

  /**
   * Extract unique assets across all wallets for aggregated legend
   */
  const aggregatedLegendData = useMemo(() => {
    if (!data || !('wallets' in data) || !data.wallets || data.wallets.length <= 1) return null;

    const uniqueAssets = new Map<string, { name: string; color: string }>();

    data.wallets.forEach((wallet: any, walletIndex: number) => {
      wallet.data.forEach((asset: any, assetIndex: number) => {
        if (!uniqueAssets.has(asset.name)) {
          uniqueAssets.set(asset.name, {
            name: asset.name,
            color: (asset as any).color ?? chartTheme.colorPalette[assetIndex % chartTheme.colorPalette.length],
          });
        }
      });
    });

    return Array.from(uniqueAssets.values());
  }, [data, chartTheme.colorPalette]);

  /**
   * Initialize selected assets when data changes
   */
  useEffect(() => {
    if (aggregatedLegendData) {
      setSelectedAssets(new Set(aggregatedLegendData.map(a => a.name)));
    }
  }, [aggregatedLegendData]);

  /**
   * Toggle asset selection for legend filtering
   */
  const toggleAssetSelection = useCallback((assetName: string) => {
    setSelectedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetName)) {
        // Don't allow deselecting all assets
        if (newSet.size > 1) {
          newSet.delete(assetName);
        }
      } else {
        newSet.add(assetName);
      }
      return newSet;
    });
  }, []);

  /**
   * ECharts options - multiple charts for per-wallet view
   */
  const chartOptions = useMemo(() => {
    if (!data) return [];

    const isMultiWallet = 'wallets' in data && data.wallets && data.wallets.length > 1;

    // Multi-wallet view
    if ('wallets' in data && data.wallets && data.wallets.length > 0) {
      return data.wallets.map((wallet: any) => ({
        walletAddress: wallet.walletAddress,
        option: createChartOption(
          wallet.data,
          wallet.totalValue,
          `${wallet.walletAddress.slice(0, 8)}...`,
          isMultiWallet
        ),
      }));
    }

    // Single/aggregated view
    if ('data' in data && data.data && data.data.length > 0) {
      return [{
        walletAddress: 'aggregated',
        option: createChartOption(data.data, data.totalValue ?? 0, undefined, false),
      }];
    }

    return [];
  }, [data, createChartOption]);

  const isEmpty =
    (loadOnInteractionOnly && interactionLoadCount === 0) ||
    !data ||
    (((!('wallets' in data) || !data.wallets || data.wallets.length === 0) &&
      (!('data' in data) || !data.data || data.data.length === 0))) ||
    (filters.wallets && filters.wallets.length === 0);

  // ── Compact header filter controls ────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    padding: '0.5rem 1rem',
    fontSize: '0.75rem',
    border: '1px solid var(--cds-border-strong)',
    borderRadius: '0.25rem',
    background: 'var(--cds-layer-02)',
    color: 'var(--cds-text-primary)',
    cursor: 'pointer',
    height: '2.5rem',
  };

  const periodToggle = loadOnInteractionOnly ? (
    <div
      className={sharedChartStyles.balanceChartWindowToggleGroup}
      style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      <button
        type="button"
        className="cds--btn cds--btn--primary cds--btn--sm"
        onClick={() => handleWindowRangeClick(chartWindowDays)}
      >
        {tr('charts.loadData')}
      </button>
      <button
        type="button"
        className={`${sharedChartStyles.chartToggleButton} ${sharedChartStyles.balanceChartWindowButton} ${interactionLoadCount > 0 && chartWindowDays === 7 ? sharedChartStyles.balanceChartWindowButtonActive : ''}`}
        onClick={() => handleWindowRangeClick(7)}
      >
        {tr('charts.balanceChart.window7d')}
      </button>
      <button
        type="button"
        className={`${sharedChartStyles.chartToggleButton} ${sharedChartStyles.balanceChartWindowButton} ${interactionLoadCount > 0 && chartWindowDays === 30 ? sharedChartStyles.balanceChartWindowButtonActive : ''}`}
        onClick={() => handleWindowRangeClick(30)}
      >
        {tr('charts.balanceChart.window30d')}
      </button>
    </div>
  ) : null;

  const filterControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
      {periodToggle}
      <select
        value={topN}
        onChange={(e) => setTopN(Number(e.target.value) as TopNOption)}
        style={selectStyle}
        aria-label={tr('charts.assetDistributionChart.ariaLabels.topNFilter')}
      >
        <option value={5}>{tr('charts.assetDistributionChart.filters.top5')}</option>
        <option value={10}>{tr('charts.assetDistributionChart.filters.top10')}</option>
        <option value={0}>{tr('charts.assetDistributionChart.filters.all')}</option>
      </select>
      <select
        value={minPct}
        onChange={(e) => setMinPct(Number(e.target.value) as MinPctOption)}
        style={selectStyle}
        aria-label={tr('charts.assetDistributionChart.ariaLabels.minPctFilter')}
      >
        <option value={0}>{tr('charts.assetDistributionChart.filters.allPercent')}</option>
        <option value={1}>{tr('charts.assetDistributionChart.filters.minPct1')}</option>
        <option value={5}>{tr('charts.assetDistributionChart.filters.minPct5')}</option>
        <option value={10}>{tr('charts.assetDistributionChart.filters.minPct10')}</option>
      </select>
    </div>
  );

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      preserveChildrenWhenEmpty={loadOnInteractionOnly && interactionLoadCount === 0}
      emptyState={filters.wallets && filters.wallets.length === 0
        ? {
          title: tr('charts.noWalletsTitle'),
          message: tr('charts.assetDistributionChart.noWalletsMessage'),
        }
        : undefined}
      onRetry={() => {
        if (loadOnInteractionOnly && interactionLoadCount === 0) {
          return;
        }
        refetch(false);
      }}
      onExport={handleExport}
      className={className}
      actions={filterControls}
    >
      {chartOptions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
          {/* Aggregated Legend for Multi-Wallet View */}
          {aggregatedLegendData && chartOptions.length > 1 && (
            <div
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
                    title={isSelected ? tr('charts.assetDistributionChart.legend.clickToHide').replace('{name}', asset.name) : tr('charts.assetDistributionChart.legend.clickToShow').replace('{name}', asset.name)}
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
                    <span
                      style={{
                        fontSize: '14px',
                        color: chartTheme.textColor,
                      }}
                    >
                      {asset.name}
                    </span>
                  </div>
                );
              })}
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

