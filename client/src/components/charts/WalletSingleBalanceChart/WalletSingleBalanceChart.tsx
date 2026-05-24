import { useEffect, useMemo, useRef, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useChartFiltersSync } from "@/hooks/useChartFiltersSync";
import {
    CHART_COLOR_PALETTE,
    useCarbonChartBaseOption,
} from "@/util/carbon-chart-base";
import { useChartContext } from "@/contexts/ChartContext";
import { PeriodSelector } from "@/components/common/PeriodSelector/PeriodSelector";
import type { PeriodOption } from "@/config/periodOptions";
import {
    fetchBalanceTrend,
    type InferFetcherData,
} from "@/services/chart/chartApi";
import { formatTimestampWithTimezone } from "@/util/chart-helpers";
import { formatAxisTooltip } from "@/util/tooltip-helpers";
import type { BalanceRequestParams } from "@/types/chart-api.types";
import { useStandardChartController } from "@/hooks/useChartController";
import { ChartWrapper } from "@/components/charts/shared";
import type { ChartProps } from "@/components/charts/shared/ChartProp";
import type { TimePeriod } from "@/types/chart-filters.types";
import { Table } from "@/components/tables/Table";
import type { TableColumnHeader } from "@/components/tables/Table";
import tableStyles from "@/components/tables/Table.module.scss";
import styles from "./WalletSingleBalanceChart.module.scss";

type BalanceTrendData = InferFetcherData<typeof fetchBalanceTrend>;

type BalanceSeriesPoint = { timestamp: number; value: number };

type BalanceSeries = {
  name: string;
  data: BalanceSeriesPoint[];
  unit?: "TOKEN" | "USD";
};

type WalletMeta = {
  label: string;
  identityName?: string;
};

type BalanceChartDisplayData = {
  series: BalanceSeries[];
  wallets?: string[];
  metadata: Record<string, unknown> & {
    walletMeta?: Record<string, WalletMeta>;
  };
};

type WalletIdentityCellValue = {
  label: string;
  walletAddress: string;
  toString: () => string;
};

type WalletStats = {
  walletLabel: string;
};

type WalletRow = {
  walletAddress: string;
  walletLabel: string;
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const WINDOW_PERIOD_OPTIONS: PeriodOption[] = [
  { key: "7D", labelKey: "wallet.filter7d" },
  { key: "30D", labelKey: "wallet.filter30d" },
];

function isBalanceChartDisplayData(
  value: unknown,
): value is BalanceChartDisplayData {
  if (!value || typeof value !== "object") {
    return false;
  }

  const raw = value as { series?: unknown };
  return Array.isArray(raw.series);
}

function normalizeSeriesData(
  points: Array<{ timestamp: number; value: number }>,
): BalanceSeriesPoint[] {
  const normalized = points
    .map((point) => ({
      timestamp: Number(point.timestamp),
      value: Number(point.value),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) && Number.isFinite(point.value),
    )
    .sort((a, b) => a.timestamp - b.timestamp);

  const deduped: BalanceSeriesPoint[] = [];
  for (const point of normalized) {
    if (
      deduped.length > 0 &&
      deduped[deduped.length - 1].timestamp === point.timestamp
    ) {
      deduped[deduped.length - 1] = point;
      continue;
    }
    deduped.push(point);
  }

  return deduped;
}

function shortAddress(address: string): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function compactWalletLabel(label: string, walletAddress: string): string {
  const normalized = (label || walletAddress || "").trim();
  if (!normalized) return "";

  const looksLikeAddress =
    /^[1-9A-HJ-NP-Za-km-z]{24,}$/.test(normalized) ||
    normalized === walletAddress;
  if (looksLikeAddress) {
    return shortAddress(normalized);
  }

  const maxLen = 18;
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 3)}...`;
}

export function WalletSingleBalanceChart({
  title,
  minHeight = 400,
  initialFilters = {
    timePeriod: "30D",
    wallets: [],
  },
  autoRefresh = true,
  refreshInterval = 30000,
  fetchEnabled = true,
  className,
}: ChartProps) {
  const { tr, fmt } = useLocalization();
  const chartTitle = title || tr("charts.walletSingleBalanceChart.title");

  const chartRef = useRef<ReactECharts>(null);
  const baseOption = useCarbonChartBaseOption();
  const { selectedTimezone: timezone } = useChartContext();

  const [chartWindowDays, setChartWindowDays] = useState<7 | 30>(() =>
    initialFilters.timePeriod?.toUpperCase() === "7D" ? 7 : 30,
  );
  const [activeWalletAddress, setActiveWalletAddress] = useState("");
  const [walletStatsByAddress, setWalletStatsByAddress] = useState<
    Record<string, WalletStats>
  >({});

  const { filters, setTimePeriod } = useChartFiltersSync({
    initialFilters,
    debounceDelay: 300,
  });

  const walletAddresses = useMemo(
    () =>
      Array.from(
        new Set(
          (filters.wallets ?? [])
            .map((address) => address.trim())
            .filter((address) => address.length > 0),
        ),
      ),
    [filters.wallets],
  );

  useEffect(() => {
    if (walletAddresses.length === 0) {
      setActiveWalletAddress("");
      return;
    }

    setActiveWalletAddress((prev) =>
      prev && walletAddresses.includes(prev) ? prev : walletAddresses[0],
    );
  }, [walletAddresses]);

  useEffect(() => {
    setChartWindowDays(filters.timePeriod?.toUpperCase() === "7D" ? 7 : 30);
  }, [filters.timePeriod]);

  const query = useMemo<BalanceRequestParams>(
    () => ({
      timePeriod: filters.timePeriod,
      wallets: activeWalletAddress,
      timezone,
    }),
    [filters.timePeriod, activeWalletAddress, timezone],
  );

  const {
    data: rawData,
    loadingState,
    refetch,
  } = useStandardChartController<BalanceTrendData, BalanceRequestParams>({
    fetcher: (query) =>
      fetchBalanceTrend({
        query: {
          wallets: query.wallets || "",
          timePeriod: query.timePeriod as any,
        },
      }),
    query: {
      wallets: query.wallets,
      timePeriod: query.timePeriod as any,
    },
    autoRefresh,
    refreshInterval,
    enabled: fetchEnabled && activeWalletAddress.length > 0,
  });

  const data = useMemo<BalanceChartDisplayData | null>(() => {
    if (
      rawData &&
      !("error" in rawData) &&
      isBalanceChartDisplayData(rawData)
    ) {
      return {
        ...rawData,
        series: rawData.series.map((series) => ({
          ...series,
          data: normalizeSeriesData(series.data),
        })),
      };
    }

    return null;
  }, [rawData]);

  const selectedWalletPoints = useMemo<BalanceSeriesPoint[]>(() => {
    if (!data) {
      return [];
    }

    const selectedSeries = data.series.find(
      (series) => series.unit !== "TOKEN",
    );
    return normalizeSeriesData(selectedSeries?.data ?? []);
  }, [data]);

  useEffect(() => {
    if (!activeWalletAddress || !data) {
      return;
    }

    const selectedSeries = data.series.find(
      (series) => series.unit !== "TOKEN",
    );
    const latest = selectedWalletPoints[selectedWalletPoints.length - 1];
    const walletMeta = data.metadata?.walletMeta ?? {};
    const walletLabel =
      walletMeta[activeWalletAddress]?.identityName ||
      walletMeta[activeWalletAddress]?.label ||
      selectedSeries?.name ||
      activeWalletAddress;

    setWalletStatsByAddress((prev) => ({
      ...prev,
      [activeWalletAddress]: {
        walletLabel,
      },
    }));
  }, [activeWalletAddress, data, selectedWalletPoints]);

  const selectedWallet = useMemo(() => {
    if (!activeWalletAddress) {
      return null;
    }

    const stats = walletStatsByAddress[activeWalletAddress];
    return {
      walletAddress: activeWalletAddress,
      walletLabel: stats?.walletLabel ?? activeWalletAddress,
    };
  }, [activeWalletAddress, walletStatsByAddress]);

  const walletRows = useMemo<WalletRow[]>(
    () =>
      walletAddresses.map((walletAddress) => {
        const stats = walletStatsByAddress[walletAddress];
        return {
          walletAddress,
          walletLabel: stats?.walletLabel ?? walletAddress,
        };
      }),
    [walletAddresses, walletStatsByAddress],
  );

  const windowedPoints = useMemo(() => {
    if (!selectedWallet || selectedWalletPoints.length === 0) {
      return [] as BalanceSeriesPoint[];
    }

    const latest =
      selectedWalletPoints[selectedWalletPoints.length - 1].timestamp;
    const cutoff = latest - chartWindowDays * ONE_DAY_MS;
    const filtered = selectedWalletPoints.filter(
      (point) => point.timestamp >= cutoff,
    );

    if (filtered.length > 0) {
      return filtered;
    }

    return [selectedWalletPoints[selectedWalletPoints.length - 1]];
  }, [selectedWallet, selectedWalletPoints, chartWindowDays]);

  const option = useMemo<EChartsOption | null>(() => {
    if (!selectedWallet || windowedPoints.length === 0) {
      return null;
    }

    const color = CHART_COLOR_PALETTE[0];

    return {
      ...baseOption,
      legend: { show: false },
      xAxis: {
        ...baseOption.xAxis,
        type: "time",
        boundaryGap: false as never,
        axisLabel: {
          ...baseOption.xAxis?.axisLabel,
          formatter: (value: number) =>
            formatTimestampWithTimezone(value, timezone, "MMM dd"),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        axisLabel: {
          ...baseOption.yAxis?.axisLabel,
          formatter: (value: number) => fmt.num.compact.currency(value),
        },
      },
      tooltip: {
        ...baseOption.tooltip,
        trigger: "axis",
        formatter: (params) =>
          formatAxisTooltip(
            params,
            (point) =>
              formatTimestampWithTimezone(point.value[0], timezone, "PPpp"),
            (point) => fmt.num.compact.currency(point.value[1]),
          ),
      },
      series: [
        {
          name: selectedWallet.walletLabel,
          type: "line",
          smooth: false,
          data: windowedPoints.map((point) => [point.timestamp, point.value]),
          showSymbol: windowedPoints.length <= 1,
          symbolSize: windowedPoints.length <= 1 ? 8 : 4,
          lineStyle: {
            color,
            width: 2,
          },
          itemStyle: {
            color,
          },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}4D` },
                { offset: 1, color: `${color}0D` },
              ],
            },
          },
        },
      ],
    };
  }, [selectedWallet, windowedPoints, baseOption, fmt, timezone]);

  const tableHeaders = useMemo<TableColumnHeader[]>(
    () => [
      {
        header: tr("charts.walletSingleBalanceChart.walletTable.wallet"),
        minWidth: "10rem",
      },
    ],
    [tr],
  );

  const tableRows = useMemo<any[][]>(
    () =>
      walletRows.map((wallet) => {
        const walletIdentity: WalletIdentityCellValue = {
          label: wallet.walletLabel,
          walletAddress: wallet.walletAddress,
          toString: () => wallet.walletLabel || wallet.walletAddress,
        };

        return [walletIdentity];
      }),
    [walletRows],
  );

  const tableCellRenderers = useMemo(
    () => [
      (value: unknown) => {
        const identity = value as WalletIdentityCellValue | undefined;
        const walletAddress = identity?.walletAddress ?? "";
        const label = identity?.label || walletAddress;
        const displayLabel = compactWalletLabel(label, walletAddress);

        return (
          <a
            href={`/wallets/${encodeURIComponent(walletAddress)}`}
            className={`${styles.walletName} ${styles.walletAddress}`}
            title={walletAddress}
            onClick={(event) => event.stopPropagation()}
          >
            {displayLabel}
          </a>
        );
      },
    ],
    [],
  );

  const headerControls = (
    <PeriodSelector
      value={
        (filters.timePeriod?.toUpperCase() === "7D"
          ? "7D"
          : "30D") as TimePeriod
      }
      onChange={(period) => {
        setChartWindowDays(period === "7D" ? 7 : 30);
        setTimePeriod(period);
      }}
      options={WINDOW_PERIOD_OPTIONS}
      compact
      className={styles.periodSelector}
    />
  );

  const isEmpty =
    walletRows.length === 0 || !selectedWallet || windowedPoints.length === 0;

  return (
    <ChartWrapper
      title={chartTitle}
      toolbarLayout="stacked"
      loadingState={loadingState}
      isEmpty={false}
      onRetry={() => refetch(false)}
      className={className}
      enableExport={false}
      actions={headerControls}
    >
      <div className={styles.layout}>
        <div className={styles.tablePanel}>
          <Table
            title={tr("charts.walletSingleBalanceChart.walletTable.title")}
            headers={tableHeaders}
            initialFilters={{}}
            fetcher={Promise.resolve([])}
            dataEntries={tableRows}
            filterSchema={{}}
            isSortable={[false]}
            cellRenderers={tableCellRenderers}
            enableExport={false}
            loading={loadingState.status === "loading"}
            onRowClick={(row) =>
              setActiveWalletAddress(
                String(
                  (row[0] as WalletIdentityCellValue | undefined)
                    ?.walletAddress ?? "",
                ),
              )
            }
            rowClassName={(row) =>
              String(
                (row[0] as WalletIdentityCellValue | undefined)
                  ?.walletAddress ?? "",
              ) === activeWalletAddress
                ? tableStyles.activeRow
                : undefined
            }
            maxHeight={Math.max(minHeight, 300)}
          />
        </div>

        <div className={styles.chartPanel}>
          {isEmpty ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyStateTitle}>
                {tr("charts.noDataTitle")}
              </p>
              <p className={styles.emptyStateMessage}>
                {tr("charts.noDataMessage")}
              </p>
            </div>
          ) : (
            <ReactECharts
              ref={chartRef}
              option={option as EChartsOption}
              className={styles.chartHost}
              style={{
                height: "100%",
                width: "100%",
                minHeight: `${minHeight}px`,
              }}
              notMerge
              lazyUpdate
            />
          )}
        </div>
      </div>
    </ChartWrapper>
  );
}
