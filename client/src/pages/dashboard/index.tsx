import { Grid, Column, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { PageWrapper } from "../../components/wrapper";
import { ChartProvider } from "../../contexts/ChartContext";
import { BalanceChart } from "../../components/charts/BalanceChart";

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
              
              <Tile style={{ padding: "2rem", textAlign: "center" }}>
                <h2 style={{ marginBottom: "1rem" }}>
                  {t("dashboard.placeholder.title", "More Charts Coming Soon")}
                </h2>
                <p style={{ color: "var(--cds-text-secondary)" }}>
                  {t(
                    "dashboard.placeholder.description",
                    "Additional charts including asset distribution, P&L tracking, and exchange comparison will be added here."
                  )}
                </p>
              </Tile>
            </Column>
          </Grid>
        </ChartProvider>
      </div>
    </PageWrapper>
  );
}
