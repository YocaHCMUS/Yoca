import { Grid, Column, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { lazy, Suspense } from "react";
import { PageWrapper } from "../../components/wrapper";
import { ChartProvider } from "../../contexts/ChartContext";
import { ChartSkeleton } from "../../components/charts/shared/ChartSkeleton";

// Lazy load chart components for better bundle splitting
const BalanceChart = lazy(() => import("../../components/charts/BalanceChart").then(m => ({ default: m.BalanceChart })));
const AssetDistribution = lazy(() => import("../../components/charts/AssetDistribution").then(m => ({ default: m.AssetDistribution })));
const PnLChart = lazy(() => import("../../components/charts/PnLChart").then(m => ({ default: m.PnLChart })));
const ExchangeComparison = lazy(() => import("../../components/charts/ExchangeComparison").then(m => ({ default: m.ExchangeComparison })));
const CounterpartyActivity = lazy(() => import("../../components/charts/CounterpartyActivity").then(m => ({ default: m.CounterpartyActivity })));
const VolumeBenchmark = lazy(() => import("../../components/charts/VolumeBenchmark").then(m => ({ default: m.VolumeBenchmark })));
const TransactionDistribution = lazy(() => import("../../components/charts/TransactionDistribution").then(m => ({ default: m.TransactionDistribution })));
const HoldingDurations = lazy(() => import("../../components/charts/HoldingDurations").then(m => ({ default: m.HoldingDurations })));

/**
 * Dashboard page - authenticated user dashboard
 */
export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <PageWrapper>
      <div style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <ChartProvider>
          <Grid>
            <Column lg={16} md={8} sm={4}>
              <h1 style={{ marginBottom: "1.5rem" }}>
                {t("nav.dashboard", "Dashboard")}
              </h1>
              
              {/* Balance Trend Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <BalanceChart
                    title={t("dashboard.balanceChart.title", "Portfolio Balance Trend")}
                    height={400}
                    initialTimePeriod="30D"
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Asset Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <AssetDistribution
                    title={t("dashboard.assetDistribution.title", "Asset Distribution")}
                    height={400}
                    autoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* P&L Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <PnLChart
                    title={t("dashboard.pnlChart.title", "Profit & Loss")}
                    height={400}
                    aggregation="daily"
                    autoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Exchange Comparison Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <ExchangeComparison
                    title={t("dashboard.exchangeComparison.title", "Exchange Activity Comparison")}
                    height={400}
                    initialTimePeriod="30D"
                    metric="count"
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Counterparty Activity Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <CounterpartyActivity
                    title={t("dashboard.counterpartyActivity.title", "Counterparty Transaction Analysis")}
                    height={400}
                    initialTimePeriod="30D"
                    initialTransactionType="all"
                    limit={10}
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Volume Benchmark Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={400} />}>
                  <VolumeBenchmark
                    title={t("dashboard.volumeBenchmark.title", "Trading Volume Comparison")}
                    height={400}
                    initialTimePeriod="30D"
                    chartType="line"
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Transaction Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={300} />}>
                  <TransactionDistribution
                    title={t("dashboard.transactionDistribution.title", "Transaction Activity Analysis")}
                    height={300}
                    initialTimePeriod="30D"
                    initialTransactionType="all"
                    chartMode="stacked"
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
              
              {/* Holding Durations Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <Suspense fallback={<ChartSkeleton height={300} />}>
                  <HoldingDurations
                    title={t("dashboard.holdingDurations.title", "Token Holding Durations")}
                    height={300}
                    topN={10}
                    timeUnit="days"
                    enableAutoRefresh={true}
                  />
                </Suspense>
              </Tile>
            </Column>
          </Grid>
        </ChartProvider>
      </div>
    </PageWrapper>
  );
}
