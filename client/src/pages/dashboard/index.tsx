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
                {t("nav.dashboard")}
              </h1>
              
              {/* Balance Trend Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <BalanceChart
                  minHeight={400}
                  initialFilters={{
                    initialTimePeriod: "30D",
                    wallets: ["test wallet"] // use param
                  }}
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Asset Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <AssetDistribution
                  initialFilters = {{
                    timePeriod: '30D',
                    transactionType: 'all',
                    tokens: ['All'],
                    limit: 10,
                  }}
                  minHeight={400}
                  autoRefresh={true}
                />
              </Tile>
              
              {/* P&L Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <PnLChart
                  minHeight={400}
                  aggregation="daily"
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Exchange Comparison Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <ExchangeComparison
                  minHeight={400}
                  initialTimePeriod="30D"
                  metric="count"
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Counterparty Activity Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <CounterpartyActivity
                  minHeight={400}
                  initialFilters={{
                    timePeriod: "30D",
                    transactionType: "all",
                    limit: 10,
                    tokens: ['All']
                  }}
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Volume Benchmark Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <VolumeBenchmark
                  minHeight={400}
                  initialTimePeriod="30D"
                  chartType="line"
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Transaction Distribution Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <TransactionDistribution
                  minHeight={300}
                  initialTimePeriod="30D"
                  initialTransactionType="all"
                  chartMode="stacked"
                  autoRefresh={true}
                />
              </Tile>
              
              {/* Holding Durations Chart */}
              <Tile style={{ marginBottom: "1.5rem", padding: "1.5rem" }}>
                <HoldingDurations
                  minHeight={300}
                  initialFilters={{
                    topN: 10,
                    timeUnit: "days",
                    wallets: []
                  }}
                  autoRefresh={true}
                />
              </Tile>
            </Column>
          </Grid>
        </ChartProvider>
      </div>
    </PageWrapper>
  );
}
