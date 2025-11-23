import { Header } from "../../components/navigation";
import { Grid, Column, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";

/**
 * Dashboard page - placeholder for authenticated user dashboard
 */
export default function DashboardPage() {
  const { t } = useTranslation();

  return (
    <div style={{ minHeight: "100vh", background: "var(--cds-background)" }}>
      <Header />
      <main style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <h1 style={{ marginBottom: "1.5rem" }}>
              {t("nav.dashboard", "Dashboard")}
            </h1>
            <Tile style={{ padding: "2rem", textAlign: "center" }}>
              <h2 style={{ marginBottom: "1rem" }}>
                {t("dashboard.placeholder.title", "Dashboard Coming Soon")}
              </h2>
              <p style={{ color: "var(--cds-text-secondary)" }}>
                {t(
                  "dashboard.placeholder.description",
                  "This page will display user portfolio, recent transactions, and market overview."
                )}
              </p>
            </Tile>
          </Column>
        </Grid>
      </main>
    </div>
  );
}
