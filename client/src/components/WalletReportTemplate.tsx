import { useLocalization } from "@/contexts/LocalizationContext";
import type { WalletOverviewMultiPeriodResponse } from "@/services/wallet/walletApi";
import { type ReactNode, useMemo } from "react";

export type WalletReportSection = "overview" | "holdings" | "activity_risk";

interface WalletReportTemplateProps {
  walletAddress: string;
  tags: string[];
  overview: WalletOverviewMultiPeriodResponse | null;
  activeSection: WalletReportSection;
  overviewContent: ReactNode;
  holdingsContent: ReactNode;
  activityRiskContent: ReactNode;
  reportDate?: Date;
}



type OverviewDetailItem = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
};

const REPORT_WIDTH_PX = 1024;

const REPORT_PAGE_STYLE = {
  width: REPORT_WIDTH_PX,
  background: "#ffffff",
  color: "#0f172a",
  padding: 32,
  boxSizing: "border-box" as const,
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCount(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function resolveTone(value: number): "positive" | "negative" | "neutral" {
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}

export function WalletReportTemplate({
  walletAddress,
  tags,
  overview,
  activeSection,
  overviewContent,
  holdingsContent,
  activityRiskContent,
  reportDate,
}: WalletReportTemplateProps) {
  const { tr } = useLocalization();

  const dateToRender = reportDate instanceof Date && !Number.isNaN(reportDate.getTime())
    ? reportDate
    : new Date();

  const sectionLabel = useMemo(() => {
    switch (activeSection) {
      case "holdings":
        return String(tr("wallet_report.holdings"));
      case "activity_risk":
        return String(tr("wallet_report.activity_risk"));
      case "overview":
      default:
        return String(tr("wallet_report.overview"));
    }
  }, [activeSection, tr]);

  const metrics = useMemo(() => {
    const selectedPeriod = overview?.selectedPeriod;
    const selectedStats = selectedPeriod
      ? overview?.periods?.[selectedPeriod] ?? null
      : null;

    const totalAssetValue = toFiniteNumber(
      overview?.holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd,
    );
    const totalPnl = toFiniteNumber(selectedStats?.pnl?.totalUsd ?? overview?.pnlUsdTotal);
    const totalTradingVolume = toFiniteNumber(
      selectedStats?.tradingVolumeUsd ?? overview?.tradingVolumeUsd24h,
    );

    const items: { label: string; value: number }[] = [];
    if (totalAssetValue != null) {
      items.push({ label: String(tr("wallet_report.total_asset_value")), value: totalAssetValue });
    }
    if (totalPnl != null) {
      items.push({ label: String(tr("wallet_report.total_pnl")), value: totalPnl });
    }
    if (totalTradingVolume != null) {
      items.push({ label: String(tr("wallet_report.total_trading_volume")), value: totalTradingVolume });
    }

    return items;
  }, [overview, tr]);

  const overviewDetailItems = useMemo<OverviewDetailItem[]>(() => {
    const selectedPeriod = overview?.selectedPeriod ?? null;
    const selectedStats = selectedPeriod ? overview?.periods?.[selectedPeriod] ?? null : null;
    const detailItems: OverviewDetailItem[] = [];

    if (selectedPeriod) {
      detailItems.push({
        label: String(tr("wallet_report.metrics_period")),
        value: selectedPeriod,
        tone: "neutral",
      });
    }

    const assetChange24hPercent = toFiniteNumber(overview?.holdings?.change24hPercent ?? null);
    if (assetChange24hPercent != null) {
      detailItems.push({
        label: String(tr("wallet_report.asset_change_24h")),
        value: formatPercent(assetChange24hPercent),
        tone: resolveTone(assetChange24hPercent),
      });
    }

    const totalTx = toFiniteNumber(selectedStats?.transactionCount ?? null);
    const buyTx = toFiniteNumber(selectedStats?.buy?.transactionCount ?? null);
    const sellTx = toFiniteNumber(selectedStats?.sell?.transactionCount ?? null);
    const buyVolume = toFiniteNumber(selectedStats?.buy?.volumeUsd ?? null);
    const sellVolume = toFiniteNumber(selectedStats?.sell?.volumeUsd ?? null);
    const realizedPnl = toFiniteNumber(selectedStats?.pnl?.realizedUsd ?? null);
    const unrealizedPnl = toFiniteNumber(selectedStats?.pnl?.unrealizedUsd ?? null);
    const tokensTraded = toFiniteNumber(selectedStats?.tokensTradedCount ?? null);
    const tokensHolding = toFiniteNumber(
      overview?.holdings?.tokensHoldingCount ?? overview?.tokensHoldingCount ?? null,
    );

    if (totalTx != null) {
      detailItems.push({ label: String(tr("wallet_report.transaction_count")), value: formatCount(totalTx), tone: "neutral" });
    }
    if (buyTx != null) {
      detailItems.push({ label: String(tr("wallet_report.buy_tx_count")), value: formatCount(buyTx), tone: "neutral" });
    }
    if (sellTx != null) {
      detailItems.push({ label: String(tr("wallet_report.sell_tx_count")), value: formatCount(sellTx), tone: "neutral" });
    }
    if (buyVolume != null) {
      detailItems.push({ label: String(tr("wallet_report.buy_volume")), value: formatCurrency(buyVolume), tone: resolveTone(buyVolume) });
    }
    if (sellVolume != null) {
      detailItems.push({ label: String(tr("wallet_report.sell_volume")), value: formatCurrency(sellVolume), tone: resolveTone(sellVolume) });
    }
    if (realizedPnl != null) {
      detailItems.push({ label: String(tr("wallet_report.realized_pnl")), value: formatCurrency(realizedPnl), tone: resolveTone(realizedPnl) });
    }
    if (unrealizedPnl != null) {
      detailItems.push({ label: String(tr("wallet_report.unrealized_pnl")), value: formatCurrency(unrealizedPnl), tone: resolveTone(unrealizedPnl) });
    }
    if (tokensTraded != null) {
      detailItems.push({ label: String(tr("wallet_report.tokens_traded")), value: formatCount(tokensTraded), tone: "neutral" });
    }
    if (tokensHolding != null) {
      detailItems.push({ label: String(tr("wallet_report.tokens_holding")), value: formatCount(tokensHolding), tone: "neutral" });
    }

    return detailItems;
  }, [overview, tr]);

  const sectionContent = useMemo(() => {
    switch (activeSection) {
      case "holdings":
        return holdingsContent;
      case "activity_risk":
        return activityRiskContent;
      case "overview":
      default:
        return overviewContent;
    }
  }, [activeSection, activityRiskContent, holdingsContent, overviewContent]);

  return (
    <>
      {activeSection === "activity_risk" ? (
        <>{activityRiskContent}</>
      ) : (
        <div data-report-page="true" style={REPORT_PAGE_STYLE}>
        <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>{String(tr("wallet_report.wallet_audit_report"))}</h1>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
                {String(tr("wallet_report.export_date"))} {dateToRender.toLocaleDateString("en-GB")}
              </p>
            </div>
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {String(tr("wallet_report.wallet_address"))}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>{walletAddress}</div>
            </div>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {tags.length > 0 ? (
              tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    border: "1px solid #cbd5e1",
                    borderRadius: 999,
                    padding: "4px 10px",
                    fontSize: 12,
                    color: "#1e293b",
                    background: "#f8fafc",
                  }}
                >
                  {tag}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 12, color: "#64748b" }}>{String(tr("wallet_report.no_tags"))}</span>
            )}
          </div>
        </header>

        <section style={{ marginBottom: 20 }}>

          {activeSection === "overview" && metrics.length > 0 ? (
            <section style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>{String(tr("wallet_report.executive_summary"))}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                {metrics.map((metric) => (
                  <div
                    key={metric.label}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 20,
                      background: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "#64748b",
                      }}
                    >
                      {metric.label}
                    </div>
                    <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700 }}>{formatCurrency(metric.value)}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {activeSection === "overview" && overviewDetailItems.length > 0 ? (
            <section style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, background: "#ffffff", marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 500 }}>{String(tr("wallet_report.overview_details"))}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                {overviewDetailItems.map((item) => {
                  const color = item.tone === "positive"
                    ? "#16a34a"
                    : item.tone === "negative"
                      ? "#dc2626"
                      : "#0f172a";

                  return (
                    <div
                      key={item.label}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: 10,
                        padding: "10px 12px",
                        background: "#ffffff",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          color: "#64748b",
                        }}
                      >
                        {item.label}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 18, fontWeight: 700, color }}>{item.value}</div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: 20 }}>{sectionLabel}</h2>
          </div>

          <div>{sectionContent}</div>
        </section>
        </div>
      )}
    </>
  );
}
