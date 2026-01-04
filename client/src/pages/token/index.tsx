import { Column, Grid, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { Header } from "../../components/navigation";
import client from "../../api/main.js";
import { useEffect, useState } from "react";
import PageWrapper from "../../components/wrapper/PageWrapper";
interface TokenProps {
  address: string;
}
/**
 * Token page - placeholder for token management
 */
export default  function TokenPage(props: TokenProps) {
  const { t } = useTranslation();
  const address = props.address;
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const response = await client.api.tokens.markets.chart[":address"].$get({
        param: {
          address: address,
        },
      });
      if (response.status == 200) {
        const data = await response.json();
        setChartData(data);
      } 
      
    })();
  }, [address]);

  return (
    <PageWrapper>
    <div style={{ minHeight: "100vh", background: "var(--cds-background)" }}>
      <Header />
      <main style={{ padding: "2rem", maxWidth: "1584px", margin: "0 auto" }}>
        <Grid>
          <Column lg={16} md={8} sm={4}>
            <h1 style={{ marginBottom: "1.5rem" }}>
              {t("nav.tokens", "Tokens")}
            </h1>
            <Tile style={{ padding: "2rem", textAlign: "center" }}>
              <h2 style={{ marginBottom: "1rem" }}>
                {t("tokens.placeholder.title", "Token Management Coming Soon")}
              </h2>
              <p style={{ color: "var(--cds-text-secondary)" }}>
                {t(
                  "tokens.placeholder.description",
                  "This page will display token balances, transfers, and management options.",
                )}
              </p>
            </Tile>
          </Column>
        </Grid>
      </main>
    </div>
    </PageWrapper>
  );
}
