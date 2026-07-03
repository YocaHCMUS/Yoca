import { SegmentedControl } from "@/components/charts/shared/ChartControls";
import { DrawdownChart } from "@/components/charts/Drawdown";
import { PnLChart } from "@/components/charts/PnLChart";
import Tble, { TbleSortType } from "@/components/Tble";
import type { TblRw } from "@/components/Tble";
import { Card } from "@/components/common/Card/Card";
import type { TimePeriod } from "@/types/chart-filters.types";
import React, { useMemo, useState } from "react";
import styles from "./GeneralTab.module.scss";
import type WalletComparisonProp from "./WalletComparisonProp";
import { useWalletComparisonSummary, type WalletMetricSummary } from "./useWalletComparisonSummary";
import { useLocalization } from '@/contexts/LocalizationContext';

const PDF_EXPORT_SECTION_CLASS = "pdf-export-section";

const PERIOD_OPTIONS = [
  { value: "7D", label: "7D" },
  { value: "30D", label: "30D" },
] as const;

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

interface MetricDef {
  label: string;
  getValue: (s: WalletMetricSummary) => number | null;
  format: (v: number) => string;
  higherIsBetter: boolean;
}

function RiskSummaryTable({
  walletAddresses,
  fetchEnabled,
  period,
}: {
  walletAddresses: string[];
  fetchEnabled: boolean;
  period: string;
}) {
  const { summaries, loading } = useWalletComparisonSummary(walletAddresses, fetchEnabled, period);

  const metrics: MetricDef[] = useMemo(() => [
    // Page 1 — Portfolio Summary
    { label: "Win Rate", getValue: (s: WalletMetricSummary) => s.winRate, format: (v: number) => `${v.toFixed(1)}%`, higherIsBetter: true },
    { label: "Balance", getValue: (s: WalletMetricSummary) => s.totalAssetValue, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    { label: `PnL (${period})`, getValue: (s: WalletMetricSummary) => s.pnl, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    { label: "PnL %", getValue: (s: WalletMetricSummary) => s.totalAssetValue && s.totalAssetValue > 0 && s.pnl != null ? (s.pnl / s.totalAssetValue) * 100 : null, format: (v: number) => `${v.toFixed(1)}%`, higherIsBetter: true },
    // Page 2 — PnL Breakdown
    { label: "Realized PnL", getValue: (s: WalletMetricSummary) => s.realizedPnl, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    { label: "Unrealized PnL", getValue: (s: WalletMetricSummary) => s.unrealizedPnl, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    { label: `Trading Volume (${period})`, getValue: (s: WalletMetricSummary) => s.tradingVolume, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    // Page 3 — Trading Performance
    { label: "Win Count", getValue: (s: WalletMetricSummary) => s.winningTrades, format: (v: number) => v.toString(), higherIsBetter: true },
    { label: "Loss Count", getValue: (s: WalletMetricSummary) => s.losingTrades, format: (v: number) => v.toString(), higherIsBetter: false },
    { label: "Total Trades", getValue: (s: WalletMetricSummary) => s.totalTrades, format: (v: number) => v.toString(), higherIsBetter: false },
    // Page 4 — Trade Averages
    { label: "Avg Win", getValue: (s: WalletMetricSummary) => s.avgWinUsd, format: (v: number) => formatCurrency(v), higherIsBetter: true },
    { label: "Avg Loss", getValue: (s: WalletMetricSummary) => s.avgLossUsd, format: (v: number) => formatCurrency(v), higherIsBetter: false },
    { label: "Win/Loss Ratio", getValue: (s: WalletMetricSummary) => s.losingTrades && s.losingTrades > 0 && s.winningTrades != null ? s.winningTrades / s.losingTrades : null, format: (v: number) => v.toFixed(2), higherIsBetter: true },
  ], [period]);

  const bestMap = useMemo(() => {
    const map: Record<string, number> = {};
    if (!summaries) return map;
    for (const metric of metrics) {
      let bestIdx = -1;
      for (let i = 0; i < summaries.length; i++) {
        const v = metric.getValue(summaries[i]);
        if (v === null) continue;
        if (bestIdx === -1) { bestIdx = i; continue; }
        const bestVal = metric.getValue(summaries[bestIdx])!;
        if ((v > bestVal) === metric.higherIsBetter) bestIdx = i;
      }
      if (bestIdx >= 0) map[metric.label] = bestIdx;
    }
    return map;
  }, [metrics, summaries]);

  const headers = useMemo(() => [
    { key: "metric", header: "Metric", width: 140, minWidth: 120 },
    ...(summaries?.map((s) => ({
      key: `wallet_${s.address}`,
      header: `${s.address.slice(0, 6)}...${s.address.slice(-4)}`,
      width: 140,
      minWidth: 110,
      align: "end" as const,
    })) ?? []),
  ], [summaries]);

  const rows = useMemo(() => {
    if (!summaries || summaries.length === 0) return [];
    return metrics.map((metric, idx) => {
      const row: Record<string, unknown> = {
        id: `metric_${idx}`,
        _label: metric.label,
        _format: metric.format,
        _bestIdx: bestMap[metric.label] ?? -1,
      };
      for (const s of summaries) {
        const val = metric.getValue(s);
        row[`wallet_${s.address}`] = val;
        row[`sort_${s.address}`] = val ?? -Infinity;
      }
      return row as TblRw;
    });
  }, [summaries, metrics, bestMap]);

  const sortConfigs = useMemo(() => ({
    ...Object.fromEntries(
      (summaries ?? []).map((s) => [
        `wallet_${s.address}`,
        { type: TbleSortType.Number as const, field: `sort_${s.address}` },
      ]),
    ),
  }), [summaries]);

  const cellRenderers = useMemo(() => ({
    metric: (_value: unknown, row: TblRw) => (
      <span style={{ fontWeight: 600, fontSize: "0.75rem", color: "var(--yoca-text-main)" }}>
        {row._label as string}
      </span>
    ),
    ...Object.fromEntries(
      (summaries ?? []).map((s) => [
        `wallet_${s.address}`,
        (value: unknown, row: TblRw) => {
          const val = value as number | null;
          const bestIdx = row._bestIdx as number;
          const walletIdx = (summaries ?? []).findIndex((x) => x.address === s.address);
          const isBest = bestIdx >= 0 && walletIdx === bestIdx;
          const format = row._format as (v: number) => string;
          return (
            <span style={{
              fontFamily: "monospace",
              fontSize: "0.75rem",
              fontWeight: isBest ? 700 : 400,
              color: isBest ? "var(--yoca-success, #22c55e)" : "var(--yoca-text-main)",
              whiteSpace: "nowrap",
            }}>
              {val !== null && val !== undefined ? format(val) : "N/A"}
            </span>
          );
        },
      ]),
    ),
  }), [summaries]);

  if (!summaries || summaries.length === 0) return null;

  return (
    <Tble
      rows={rows}
      headers={headers}
      sortConfigs={sortConfigs}
      cellRenderers={cellRenderers}
      enablePagination
      pageSize={7}
      pageSizes={[7]}
      boxed
      loading={loading}
    />
  );
}

export const RiskTab: React.FC<WalletComparisonProp> = ({
  walletAddresses,
  fetchEnabled = true,
  onDayClick,
}) => {
  const { tr } = useLocalization();
  const [period, setPeriod] = useState("30D" as string);

  if (!walletAddresses || walletAddresses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <h3>No Wallets Selected</h3>
          <p>Please select at least one wallet to view comparison data.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {/* Risk Summary Comparison Table */}
      <div className={`${PDF_EXPORT_SECTION_CLASS}`}>
        <Card
          title="Risk Summary"
          actions={
            <SegmentedControl
              ariaLabel="Time period"
              value={period}
              onChange={setPeriod}
              options={PERIOD_OPTIONS}
            />
          }
        >
          <RiskSummaryTable walletAddresses={walletAddresses} fetchEnabled={fetchEnabled} period={period} />
        </Card>
      </div>

      <PnLChart minHeight={300} initialWallets={walletAddresses} fetchEnabled={fetchEnabled} onDayClick={onDayClick}
      />

      <DrawdownChart
        minHeight={300}
        initialFilters={{
          timePeriod: period as TimePeriod,
          wallets: walletAddresses,
        }}
        fetchEnabled={fetchEnabled}
      />



    </div>
  );
};
