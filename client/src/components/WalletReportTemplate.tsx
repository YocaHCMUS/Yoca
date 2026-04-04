import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution";
import { BalanceChart } from "@/components/charts/BalanceChart";
import type { CSSProperties } from "react";
import type {
  WalletCounterpartyRow,
  WalletOverviewMultiPeriodResponse,
  WalletOverviewPeriodStats,
  WalletPortfolioItem,
} from "@/services/wallet/walletApi";

type MetricItem = {
  label: string;
  value: number;
};

type OverviewDetailItem = {
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
};

interface WalletReportTemplateProps {
  walletAddress: string;
  tags: string[];
  holdings: WalletPortfolioItem[];
  overview: WalletOverviewMultiPeriodResponse | null;
  counterparties: WalletCounterpartyRow[];
  balanceTokenOptions: string[];
  reportDate?: Date;
}

const REPORT_WIDTH_PX = 1024;
const REPORT_PAGE_HEIGHT_PX = 1448;
const SECTION_CARD_STYLE: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: 20,
  background: "#ffffff",
};

const REPORT_PAGE_STYLE: CSSProperties = {
  width: REPORT_WIDTH_PX,
  minHeight: REPORT_PAGE_HEIGHT_PX,
  background: "#ffffff",
  color: "#0f172a",
  padding: 32,
  boxSizing: "border-box",
  fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function toFiniteNumber(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
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

function buildMetrics(
  overview: WalletOverviewMultiPeriodResponse | null,
  holdings: WalletPortfolioItem[],
): MetricItem[] {
  const selectedPeriod = overview?.selectedPeriod;
  const selectedStats: WalletOverviewPeriodStats | null = selectedPeriod
    ? overview?.periods?.[selectedPeriod] ?? null
    : null;

  const holdingsValue = holdings.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0);
  const totalAssetValue = toFiniteNumber(
    overview?.holdings?.totalAssetValueUsd ?? overview?.totalAssetValueUsd ?? holdingsValue,
  );
  const totalPnl = toFiniteNumber(selectedStats?.pnl?.totalUsd ?? overview?.pnlUsdTotal);
  const totalTradingVolume = toFiniteNumber(
    selectedStats?.tradingVolumeUsd ?? overview?.tradingVolumeUsd24h,
  );

  const metrics: MetricItem[] = [];
  if (totalAssetValue != null) {
    metrics.push({ label: "Total Asset Value", value: totalAssetValue });
  }
  if (totalPnl != null) {
    metrics.push({ label: "Total PnL", value: totalPnl });
  }
  if (totalTradingVolume != null) {
    metrics.push({ label: "Total Trading Volume", value: totalTradingVolume });
  }

  return metrics;
}

function getTopHoldings(holdings: WalletPortfolioItem[], limit: number): WalletPortfolioItem[] {
  return [...holdings]
    .sort((a, b) => Number(b.valueUsd ?? 0) - Number(a.valueUsd ?? 0))
    .slice(0, limit);
}

function shortenAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function WalletReportTemplate({
  walletAddress,
  tags,
  holdings,
  overview,
  counterparties,
  balanceTokenOptions,
  reportDate,
}: WalletReportTemplateProps) {
  const dateToRender = reportDate instanceof Date && !Number.isNaN(reportDate.getTime())
    ? reportDate
    : new Date();

  const metrics = buildMetrics(overview, holdings);
  const selectedPeriod = overview?.selectedPeriod ?? null;
  const selectedStats = selectedPeriod ? overview?.periods?.[selectedPeriod] ?? null : null;
  const assetChange24hPercent = toFiniteNumber(overview?.holdings?.change24hPercent ?? null);
  const detailItems: OverviewDetailItem[] = [];

  if (selectedPeriod) {
    detailItems.push({
      label: "Metrics Period",
      value: selectedPeriod,
      tone: "neutral",
    });
  }
  if (assetChange24hPercent != null) {
    detailItems.push({
      label: "Asset Change (24H)",
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
  const tokensHolding = toFiniteNumber(overview?.holdings?.tokensHoldingCount ?? overview?.tokensHoldingCount ?? null);

  if (totalTx != null) {
    detailItems.push({ label: "Transaction Count", value: formatCount(totalTx), tone: "neutral" });
  }
  if (buyTx != null) {
    detailItems.push({ label: "Buy Tx Count", value: formatCount(buyTx), tone: "neutral" });
  }
  if (sellTx != null) {
    detailItems.push({ label: "Sell Tx Count", value: formatCount(sellTx), tone: "neutral" });
  }
  if (buyVolume != null) {
    detailItems.push({ label: "Buy Volume", value: formatCurrency(buyVolume), tone: resolveTone(buyVolume) });
  }
  if (sellVolume != null) {
    detailItems.push({ label: "Sell Volume", value: formatCurrency(sellVolume), tone: resolveTone(sellVolume) });
  }
  if (realizedPnl != null) {
    detailItems.push({ label: "Realized PnL", value: formatCurrency(realizedPnl), tone: resolveTone(realizedPnl) });
  }
  if (unrealizedPnl != null) {
    detailItems.push({ label: "Unrealized PnL", value: formatCurrency(unrealizedPnl), tone: resolveTone(unrealizedPnl) });
  }
  if (tokensTraded != null) {
    detailItems.push({ label: "Tokens Traded", value: formatCount(tokensTraded), tone: "neutral" });
  }
  if (tokensHolding != null) {
    detailItems.push({ label: "Tokens Holding", value: formatCount(tokensHolding), tone: "neutral" });
  }

  const topHoldings = getTopHoldings(holdings, 10);
  const totalTopHoldingsValue = topHoldings.reduce((sum, item) => sum + Number(item.valueUsd ?? 0), 0);
  const topCounterparties = [...counterparties]
    .sort((a, b) => Number(b.totalVolumeUsd ?? 0) - Number(a.totalVolumeUsd ?? 0))
    .slice(0, 10);
  const totalPages = topCounterparties.length > 0 ? 3 : 2;

  const renderPageFooter = (pageNumber: number) => (
    <footer
      style={{
        borderTop: "1px solid #e2e8f0",
        paddingTop: 12,
        fontSize: 12,
        color: "#64748b",
        display: "flex",
        justifyContent: "space-between",
        marginTop: 20,
      }}
    >
      <span>
        Page {pageNumber} / {totalPages}
      </span>
      <span>Generated from live wallet data</span>
    </footer>
  );

  return (
    <div style={{ width: REPORT_WIDTH_PX, background: "#ffffff" }}>
      <div data-report-page="true" style={REPORT_PAGE_STYLE}>
        <header style={{ borderBottom: "1px solid #e2e8f0", paddingBottom: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>Wallet Audit Report</h1>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
                Export Date: {dateToRender.toLocaleDateString("en-GB")}
              </p>
            </div>
            <div style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Wallet Address
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
              <span style={{ fontSize: 12, color: "#64748b" }}>No Tags</span>
            )}
          </div>
        </header>

        {metrics.length > 0 ? (
          <section style={{ marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Executive Summary</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
              {metrics.map((metric) => (
                <div key={metric.label} style={SECTION_CARD_STYLE}>
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

        {detailItems.length > 0 ? (
          <section style={{ ...SECTION_CARD_STYLE, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>Overview Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {detailItems.map((item) => {
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

        <section style={{ ...SECTION_CARD_STYLE, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>1. Assets</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, alignItems: "start" }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <AssetDistribution
                minHeight={340}
                autoRefresh={true}
                initialFilters={{
                  timePeriod: "7D",
                  wallets: [walletAddress],
                }}
              />
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 12 }}>
              <h3 style={{ margin: "0 0 10px", fontSize: 14, textTransform: "uppercase", color: "#64748b" }}>
                Top Holdings
              </h3>
              {topHoldings.length > 0 ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                      <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Token</th>
                      <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Value</th>
                      <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topHoldings.map((item) => {
                      const valueUsd = Number(item.valueUsd ?? 0);
                      const weight = totalTopHoldingsValue > 0
                        ? (valueUsd / totalTopHoldingsValue) * 100
                        : 0;
                      return (
                        <tr key={item.tokenAddress}>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                            {item.symbol || item.name || "N/A"}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                            {formatCurrency(valueUsd)}
                          </td>
                          <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                            {weight.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <div style={{ color: "#64748b", fontSize: 13 }}>No holdings data available.</div>
              )}
            </div>
          </div>
        </section>

        {renderPageFooter(1)}
      </div>

      <div data-report-page="true" style={REPORT_PAGE_STYLE}>
        <section style={{ ...SECTION_CARD_STYLE, marginBottom: 20 }}>
          <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>2. Activity</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: 10 }}>
              <BalanceChart
                minHeight={320}
                autoRefresh={true}
                initialFilters={{
                  timePeriod: "7D",
                  wallets: [walletAddress],
                }}
                tokenSelectorOptions={
                  balanceTokenOptions.length > 0
                    ? balanceTokenOptions
                    : ["SOL", "USDC", "USDT"]
                }
              />
            </div>
          </div>
        </section>

        {renderPageFooter(2)}
      </div>

      {topCounterparties.length > 0 ? (
        <div data-report-page="true" style={REPORT_PAGE_STYLE}>
          <section style={{ ...SECTION_CARD_STYLE, marginBottom: 20 }}>
            <h2 style={{ margin: "0 0 12px", fontSize: 20 }}>3. Network</h2>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                  <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Counterparty</th>
                  <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Transactions</th>
                  <th style={{ borderBottom: "1px solid #e2e8f0", padding: "8px 6px" }}>Volume (USD)</th>
                </tr>
              </thead>
              <tbody>
                {topCounterparties.map((counterparty) => (
                  <tr key={counterparty.address}>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                      {counterparty.identity?.name || shortenAddress(counterparty.address)}
                    </td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                      {Number(counterparty.transactionCount ?? 0).toLocaleString("en-US")}
                    </td>
                    <td style={{ borderBottom: "1px solid #f1f5f9", padding: "8px 6px" }}>
                      {formatCurrency(Number(counterparty.totalVolumeUsd ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {renderPageFooter(3)}
        </div>
      ) : null}
    </div>
  );
}
