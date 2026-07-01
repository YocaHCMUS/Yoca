import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { EChartsInstance } from "@/util/echarts-setup";
import { SlidersHorizontal } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
  CHART_COLOR_PALETTE,
  useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { cds } from "@/util/carbon-theme";
import { useChartContext } from "@/contexts/ChartContext";
import { fetchAssetDistribution, type InferFetcherData } from "@/services/chart/chartApi";
import { createTooltipHeader, createTooltipRow } from "@/util/tooltip-helpers";
import type { DistributionRequestParams } from "@/types/chart-api.types";
import { useStandardChartController } from "@/hooks/useChartController";
import { ChartWrapper, ChartGrid, ChartGridItem } from "@/components/charts/shared";
import { useChartExport } from "@/hooks/useChartExport";
import type { ExportFormat } from "@/types/chart-filters.types";
import type { ChartDataSeries } from "@/types/chart-data.types";
import type { ChartProps } from "../shared/ChartProp";
import { runChartExport } from "@/services/chart/chartExportService";
import { IconActionButton, SegmentedControl } from "@/components/charts/shared/ChartControls";
import styles from "./AssetDistribution.module.scss";

type TopNOption = 5 | 10;
type MinPctOption = 0 | 1 | 5 | 10;
const MAX_VISIBLE_OTHERS = 10;
const OTHERS_COLOR = "#8a8a8a";

interface LegendAsset {
  name: string;
  color: string;
  value: number;
}

interface AssetItem {
  name: string;
  value: number;
  percentage: number;
  color?: string;
  logoUri?: string;
}

interface HiddenAssetItem {
  name: string;
  value: number;
  percentage: number;
}

type GroupedAssetItem = AssetItem & {
  hiddenNames?: string[];
  hiddenItems?: HiddenAssetItem[];
};

interface WalletDistribution {
  walletAddress: string;
  data: AssetItem[];
}

interface TooltipParam {
  name?: string;
  value?: number;
  data?: GroupedAssetItem;
}

interface ChartEntry {
  walletAddress: string;
  option: EChartsOption;
  grouped: GroupedAssetItem[];
}

function applyGrouping(
  raw: AssetItem[],
  topN: TopNOption,
  minPct: MinPctOption,
  othersLabel: string,
): GroupedAssetItem[] {
  if (raw.length === 0) return [];

  const rawTotal = raw.reduce((sum, asset) => sum + asset.value, 0);
  const withPct = raw
    .map((asset) => ({
      ...asset,
      percentage: rawTotal > 0 ? (asset.value / rawTotal) * 100 : 0,
    }))
    .sort((left, right) => right.value - left.value);

  const afterMinPct = minPct > 0
    ? withPct.filter((asset) => asset.percentage >= minPct)
    : withPct;
  const kept = topN > 0 ? afterMinPct.slice(0, topN) : afterMinPct;
  const keptNames = new Set(kept.map((asset) => asset.name));
  const hidden = withPct.filter((asset) => !keptNames.has(asset.name));

  if (hidden.length === 0) return kept;

  const othersValue = hidden.reduce((sum, asset) => sum + asset.value, 0);
  const groupedTotal = kept.reduce((sum, asset) => sum + asset.value, 0) + othersValue;
  const recalcKept = kept.map((asset) => ({
    ...asset,
    percentage: groupedTotal > 0 ? (asset.value / groupedTotal) * 100 : 0,
  }));

  return [
    ...recalcKept,
    {
      name: othersLabel,
      value: othersValue,
      percentage: groupedTotal > 0 ? (othersValue / groupedTotal) * 100 : 0,
      color: OTHERS_COLOR,
      hiddenNames: hidden.map((asset) => asset.name),
      hiddenItems: hidden.map((asset) => ({
        name: asset.name,
        value: asset.value,
        percentage: asset.percentage,
      })),
    },
  ];
}

function chartColorFor(asset: GroupedAssetItem, index: number, othersLabel: string) {
  if (asset.name === othersLabel) return OTHERS_COLOR;
  return asset.color ?? CHART_COLOR_PALETTE[index % CHART_COLOR_PALETTE.length];
}

function normalizeWallets(data: AssetDistributionData | null | undefined): WalletDistribution[] {
  if (!data || !("wallets" in data) || !data.wallets) return [];
  return data.wallets.map((wallet) => ({
    walletAddress: wallet.walletAddress,
    data: wallet.data as AssetItem[],
  }));
}

function buildGroupedAssets(
  data: AssetItem[],
  selectedAssets: Set<string>,
  isMultiWallet: boolean,
  topN: TopNOption,
  minPct: MinPctOption,
  othersLabel: string,
) {
  const filtered = isMultiWallet && selectedAssets.size > 0
    ? data.filter((asset) => selectedAssets.has(asset.name))
    : data;
  return applyGrouping(filtered, topN, minPct, othersLabel);
}

type AssetDistributionData = InferFetcherData<typeof fetchAssetDistribution>;

export const AssetDistribution: React.FC<ChartProps> = ({
  minHeight = 400,
  initialFilters,
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
  actions: externalActions,
}) => {
  const { tr, fmt } = useLocalization();
  const chartTitle = tr("charts.assetDistributionChart.title");
  const othersLabel = tr("charts.assetDistributionChart.others");

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
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set());
  const [topN, setTopN] = useState<TopNOption>(5);
  const [minPct, setMinPct] = useState<MinPctOption>(0);

  const { filters, walletsString } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const query = useMemo<DistributionRequestParams>(
    () => ({
      period: filters.timePeriod,
      wallets: walletsString,
    }),
    [filters.timePeriod, walletsString],
  );

  const { data, loadingState, refetch } =
    useStandardChartController<AssetDistributionData, DistributionRequestParams>({
      fetcher: fetchAssetDistribution,
      query,
      autoRefresh,
      refreshInterval,
      enabled: fetchEnabled,
    });

  const { exportPNG, exportSVG, exportPDF, exportCSV } = useChartExport({
    chartTitle,
    timezone,
    baseFilename: "asset-distribution",
  });

  const wallets = useMemo(() => normalizeWallets(data), [data]);

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!data) return;

      const instance = chartRef.current?.getEchartsInstance() as EChartsInstance | undefined;
      const csv: ChartDataSeries[] = wallets.map((wallet) => {
        const grouped = applyGrouping(wallet.data, topN, minPct, othersLabel);
        return {
          id: `asset-distribution-${wallet.walletAddress}`,
          name: `${tr("charts.assetDistributionChart.export.name")} - ${wallet.walletAddress}`,
          type: "pie",
          visible: true,
          data: grouped.map((asset) => ({
            name: asset.name,
            value: asset.value,
          })),
        };
      });

      await runChartExport(
        {
          format,
          filters,
          chartInstance: instance ?? null,
          csvData: csv,
          csvFilters: { ...filters, wallets: [] },
          extraFilters: {
            [tr("charts.assetDistributionChart.filters.topN")]: `${tr("charts.assetDistributionChart.filters.top")} ${topN}`,
            [tr("charts.assetDistributionChart.filters.minPct")]: minPct === 0
              ? tr("charts.assetDistributionChart.filters.all")
              : `>${minPct}%`,
          },
        },
        { exportPNG, exportSVG, exportPDF, exportCSV },
      );
    },
    [data, exportCSV, exportPDF, exportPNG, exportSVG, filters, minPct, othersLabel, topN, tr, wallets],
  );

  const createChartOption = useCallback((grouped: GroupedAssetItem[], walletLabel?: string): EChartsOption => {
    const displayTotal = grouped.reduce((sum, asset) => sum + asset.value, 0);
    const tooltipBackground = tokens.layer || cds.layer01;
    const tooltipBorder = tokens.borderSubtle || cds.borderSubtle01;
    const tooltipText = tokens.textPrimary || cds.textPrimary;
    const tooltipSecondaryText = tokens.textSecondary || cds.textSecondary;

    return {
      ...baseOption,
      xAxis: undefined,
      yAxis: undefined,
      title: walletLabel
        ? {
          text: walletLabel,
          left: 8,
          top: 8,
          textStyle: {
            color: baseOption.textStyle.color,
            fontSize: 16,
            fontWeight: "bold",
          },
        }
        : undefined,
      tooltip: {
        ...baseOption.tooltip,
        trigger: "item",
        appendToBody: true,
        confine: true,
        backgroundColor: tooltipBackground,
        borderColor: tooltipBorder,
        borderWidth: 1,
        extraCssText: "box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16); max-width: 260px; z-index: 10000;",
        textStyle: { color: tooltipText, fontSize: 12 },
        formatter: (rawParam: unknown) => {
          const param = rawParam as TooltipParam;
          const asset = param.data;
          const name = param.name ?? asset?.name ?? "";
          const isOthers = name === othersLabel;
          const logoHtml = asset?.logoUri
            ? `<img src="${asset.logoUri}" alt="${name}" width="16" height="16" style="border-radius:50%;vertical-align:middle;margin-right:4px;" onerror="this.style.display='none'">`
            : "";
          let html = createTooltipHeader(`${logoHtml}${name}`);

          if (isOthers && asset?.hiddenNames && asset.hiddenNames.length > 0) {
            const visibleHiddenNames = asset.hiddenNames.slice(0, MAX_VISIBLE_OTHERS);
            const hiddenSummary = asset.hiddenNames.length > MAX_VISIBLE_OTHERS
              ? `${tr("charts.assetDistributionChart.filters.top")} ${MAX_VISIBLE_OTHERS} / ${asset.hiddenNames.length}`
              : `${asset.hiddenNames.length}`;
            html += "<div style=\"margin-bottom:8px;padding-top:2px;\">";
            html += `<div style="padding-bottom:3px;font-size:11px;font-weight:600;color:${tooltipText}">${hiddenSummary}</div>`;
            html += visibleHiddenNames
              .map((hiddenName, index) => `<div style="padding:1px 0;font-size:11px;line-height:1.35;color:${tooltipSecondaryText}">${index + 1}. ${hiddenName}</div>`)
              .join("");
            if (asset.hiddenNames.length > MAX_VISIBLE_OTHERS) {
              html += `<div style="padding:2px 0 0;font-size:11px;line-height:1.35;color:${tooltipSecondaryText}">...</div>`;
            }
            html += "</div>";
          }

          html += createTooltipRow(
            tr("charts.assetDistributionChart.value"),
            fmt.num.compact.currency(Number(param.value ?? asset?.value ?? 0)),
          );
          html += createTooltipRow(
            tr("charts.assetDistributionChart.percentage"),
            `${Number(asset?.percentage ?? 0).toFixed(2)}%`,
          );
          return html;
        },
      },
      legend: { show: false },
      series: [
        {
          type: "pie",
          radius: ["54%", "78%"],
          center: ["50%", "50%"],
          data: grouped.map((asset, index) => ({
            ...asset,
            itemStyle: {
              color: chartColorFor(asset, index, othersLabel),
              borderColor: tokens.layer || cds.layer01,
              borderWidth: 2,
              borderRadius: 6,
            },
          })),
          label: { show: false },
          labelLine: { show: false },
          emphasis: { label: { show: false } },
        },
      ],
      graphic: [
        {
          type: "text",
          left: "center",
          top: "43%",
          style: {
            text: fmt.num.compact.currency(displayTotal),
            fill: baseOption.textStyle.color,
            fontSize: 18,
            fontWeight: "bold",
          },
        },
        {
          type: "text",
          left: "center",
          top: "53%",
          style: {
            text: tr("charts.assetDistributionChart.total"),
            fill: tokens.textSecondary || cds.textSecondary,
            fontSize: 11,
            fontWeight: 600,
          },
        },
      ],
    };
  }, [baseOption, fmt, othersLabel, tokens, tr]);

  const aggregatedLegendData = useMemo(() => {
    if (wallets.length <= 1) return null;

    const uniqueAssets = new Map<string, LegendAsset>();
    wallets.forEach((wallet) => {
      wallet.data.forEach((asset, assetIndex) => {
        const existingAsset = uniqueAssets.get(asset.name);
        if (existingAsset) {
          existingAsset.value += Number(asset.value ?? 0);
          return;
        }
        uniqueAssets.set(asset.name, {
          name: asset.name,
          color: asset.color ?? CHART_COLOR_PALETTE[assetIndex % CHART_COLOR_PALETTE.length],
          value: Number(asset.value ?? 0),
        });
      });
    });

    return Array.from(uniqueAssets.values()).sort((left, right) => right.value - left.value);
  }, [wallets]);

  useEffect(() => {
    if (!aggregatedLegendData) return;

    if (selectedAssets.size === 0) {
      setSelectedAssets(new Set(aggregatedLegendData.map((asset) => asset.name)));
      return;
    }

    const availableAssets = new Set(aggregatedLegendData.map((asset) => asset.name));
    const nextSelectedAssets = new Set(
      Array.from(selectedAssets).filter((assetName) => availableAssets.has(assetName)),
    );

    if (nextSelectedAssets.size !== selectedAssets.size) {
      setSelectedAssets(
        nextSelectedAssets.size > 0
          ? nextSelectedAssets
          : new Set(aggregatedLegendData.map((asset) => asset.name)),
      );
    }
  }, [aggregatedLegendData, selectedAssets]);

  const chartOptions = useMemo<ChartEntry[]>(() => {
    if (wallets.length === 0) return [];
    const isMultiWallet = wallets.length > 1;

    return wallets.map((wallet) => {
      const grouped = buildGroupedAssets(wallet.data, selectedAssets, isMultiWallet, topN, minPct, othersLabel);
      return {
        walletAddress: wallet.walletAddress,
        grouped,
        option: createChartOption(
          grouped,
          isMultiWallet ? `${wallet.walletAddress.slice(0, 8)}...` : undefined,
        ),
      };
    });
  }, [createChartOption, minPct, othersLabel, selectedAssets, topN, wallets]);

  const isEmpty = wallets.length === 0 || Boolean(filters.wallets && filters.wallets.length === 0);

  const topNOptions: Array<{ value: TopNOption; label: string }> = [
    { value: 5, label: tr("charts.assetDistributionChart.filters.top5") },
    { value: 10, label: tr("charts.assetDistributionChart.filters.top10") }
  ];

  const minPctOptions: Array<{ value: MinPctOption; label: string }> = [
    { value: 1, label: tr("charts.assetDistributionChart.filters.minPct1") },
    { value: 5, label: tr("charts.assetDistributionChart.filters.minPct5") },
    { value: 10, label: tr("charts.assetDistributionChart.filters.minPct10") },
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

  const combinedActions = externalActions ? (
    <>{externalActions}{filterControls}</>
  ) : filterControls;

  return (
    <ChartWrapper
      title={chartTitle}
      loadingState={loadingState}
      isEmpty={isEmpty}
      emptyState={filters.wallets && filters.wallets.length === 0
        ? {
          title: tr("charts.noWalletsTitle"),
          message: tr("charts.assetDistributionChart.noWalletsMessage"),
        }
        : undefined}
      onRetry={() => refetch(false)}
      onExport={handleExport}
      className={className}
      wrapperMinHeight={minHeight}
      actions={combinedActions}
      enableExport={false}
      enableFullscreen={false}
      enableMiniPlayer={false}
    >
      {chartOptions.length > 0 && (
        <div className={styles.assetDistributionContent}>
          {aggregatedLegendData && chartOptions.length > 1 && (
            <AssetSelector
              assets={aggregatedLegendData}
              selectedAssets={selectedAssets}
              onChange={setSelectedAssets}
            />
          )}

          <ChartGrid
            itemCount={chartOptions.length}
            multiItemColumns={Math.min(3, chartOptions.length)}
          >
            {chartOptions.map((chartData, index) => (
              <ChartGridItem
                key={chartData.walletAddress}
                itemKey={chartData.walletAddress}
                minHeight={minHeight}
              >
                <div className={styles.distributionLayout}>
                  <div className={styles.donutPane}>
                    <ReactECharts
                      ref={index === 0 ? chartRef : undefined}
                      option={chartData.option}
                      style={{ height: "100%", width: "100%", minHeight: `${Math.max(220, minHeight - 40)}px` }}
                      notMerge
                      lazyUpdate
                    />
                  </div>
                  <AssetLegend items={chartData.grouped} othersLabel={othersLabel} />
                </div>
              </ChartGridItem>
            ))}
          </ChartGrid>
        </div>
      )}
    </ChartWrapper>
  );
};

export function AssetLegend({ items, othersLabel }: { items: GroupedAssetItem[]; othersLabel: string }) {
  return (
    <div className={styles.legendPane} data-testid="asset-distribution-legend">
      <div className={styles.legendList}>
        {items.map((asset, index) => (
          <div key={asset.name} className={styles.legendRow}>
            <span
              className={styles.legendSwatch}
              style={{ backgroundColor: chartColorFor(asset, index, othersLabel) }}
            />
            <span className={styles.legendName}>{asset.name}</span>
            <span className={styles.legendPercent}>{asset.percentage.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetSelector({
  assets,
  selectedAssets,
  onChange,
}: {
  assets: LegendAsset[];
  selectedAssets: Set<string>;
  onChange: (assets: Set<string>) => void;
}) {
  const { tr } = useLocalization();

  const toggleAsset = (assetName: string, checked: boolean) => {
    const next = new Set(selectedAssets);
    if (checked) next.add(assetName);
    else if (next.size > 1) next.delete(assetName);
    onChange(next);
  };

  return (
    <div className={styles.assetSelector} data-html2canvas-ignore="true">
      <span className={styles.assetSelectorLabel}>{tr("charts.balanceChart.selectTokenLabel")}</span>
      <div className={styles.assetSelectorList}>
        {assets.map((asset) => (
          <label key={asset.name} className={styles.assetSelectorItem}>
            <input
              type="checkbox"
              checked={selectedAssets.has(asset.name)}
              onChange={(event) => toggleAsset(asset.name, event.target.checked)}
            />
            <span className={styles.assetSelectorSwatch} style={{ backgroundColor: asset.color }} />
            <span>{asset.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

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
  setTopN: (value: TopNOption) => void;
  setMinPct: (value: MinPctOption) => void;
  topNOptions: Array<{ value: TopNOption; label: string }>;
  minPctOptions: Array<{ value: MinPctOption; label: string }>;
}) {
  const { tr } = useLocalization();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className={styles.filterMenu}>
      <IconActionButton
        icon={SlidersHorizontal}
        label={tr("charts.assetDistributionChart.filtersMenu")}
        onClick={() => setOpen((current) => !current)}
      />
      {open && (
        <div className={styles.filterPopover} role="dialog" aria-label={tr("charts.assetDistributionChart.filtersMenu")}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{tr("charts.assetDistributionChart.filters.topN")}</span>
            <SegmentedControl
              ariaLabel={tr("charts.assetDistributionChart.filters.topN")}
              value={String(topN)}
              options={topNOptions.map((option) => ({ value: String(option.value), label: option.label }))}
              onChange={(value) => setTopN(Number(value) as TopNOption)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>{tr("charts.assetDistributionChart.filters.minPct")}</span>
            <SegmentedControl
              ariaLabel={tr("charts.assetDistributionChart.filters.minPct")}
              value={String(minPct)}
              options={minPctOptions.map((option) => ({ value: String(option.value), label: option.label }))}
              onChange={(value) => setMinPct(Number(value) as MinPctOption)}
            />
          </div>
        </div>
      )}
    </div>
  );
}



