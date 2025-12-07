import { Grid, Column, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { PageWrapper } from "../../components/wrapper";
import { ChartProvider } from "../../contexts/ChartContext";
import { BalanceChart } from "../../components/charts/BalanceChart";
import { AssetDistribution } from "../../components/charts/AssetDistribution";
import { PnLChart } from "../../components/charts/PnLChart";
import { ExchangeComparison } from "../../components/charts/ExchangeComparison";
import { CounterpartyActivity } from "../../components/charts/CounterpartyActivity";
import { VolumeBenchmark } from "../../components/charts/VolumeBenchmark";
import { TransactionDistribution } from "../../components/charts/TransactionDistribution";
import { HoldingDurations } from "../../components/charts/HoldingDurations";

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
                <BalanceChart
                  title={t("dashboard.balanceChart.title", "Portfolio Balance Trend")}
                  height={400}
                  initialTimePeriod="30D"
                  enableAutoRefresh={true}
                />
              </Tile>
              
              {/* Asset Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <AssetDistribution
                  title={t("dashboard.assetDistribution.title", "Asset Distribution")}
                  height={400}
                  autoRefresh={true}
                />
              </Tile>
              
              {/* P&L Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <PnLChart
                  title={t("dashboard.pnlChart.title", "Profit & Loss")}
                  height={400}
                  aggregation="daily"
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Exchange Comparison Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <ExchangeComparison
                  title={t("dashboard.exchangeComparison.title", "Exchange Activity Comparison")}
                  height={400}
                  initialTimePeriod="30D"
                  metric="count"
                  enableAutoRefresh={true}
                />
              </Tile>
              
              {/* Counterparty Activity Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <CounterpartyActivity
                  title={t("dashboard.counterpartyActivity.title", "Counterparty Transaction Analysis")}
                  height={400}
                  initialTimePeriod="30D"
                  initialTransactionType="all"
                  limit={10}
                  enableAutoRefresh={true}
                />
              </Tile>
              
              {/* Volume Benchmark Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <VolumeBenchmark
                  title={t("dashboard.volumeBenchmark.title", "Trading Volume Comparison")}
                  height={400}
                  initialTimePeriod="30D"
                  chartType="line"
                  enableAutoRefresh={true}
                />
              </Tile>
              
              {/* Transaction Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <TransactionDistribution
                  title={t("dashboard.transactionDistribution.title", "Transaction Activity Analysis")}
                  height={300}
                  initialTimePeriod="30D"
                  initialTransactionType="all"
                  chartMode="stacked"
                  enableAutoRefresh={true}
                />
              </Tile>
              
              {/* Holding Durations Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <HoldingDurations
                  title={t("dashboard.holdingDurations.title", "Token Holding Durations")}
                  height={300}
                  topN={10}
                  timeUnit="days"
                  enableAutoRefresh={true}
                />
              </Tile>
            </Column>
          </Grid>
        </ChartProvider>
      </div>
    </PageWrapper>
  );
}
