import { Column, Grid, Tile } from "@carbon/react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import { Header } from "../../components/navigation";
import client from "../../api/main.js";
import { useEffect, useState } from "react";
import PageWrapper from "../../components/wrapper/PageWrapper";
import type { InferRequestType, InferResponseType } from 'hono/client';
import { parseResponse, DetailedError } from 'hono/client';
import { TokenPriceChart } from "../../components/charts/TokenPriceChart";
// interface TokenProps {
//   address: string;
// }

const $get = client.api.tokens.markets.chart[":address"].$get;
type ResType = InferResponseType<typeof $get,200>



// result contains the parsed response body (automatically parsed based on Content-Type
// parseResponse automatically throws an error if response is not ok
// const $get: InferRequestType<$get> = {
//   param: {
//     address: address,
//   },
// };
// const $get: InferResponseType<$get> = {
//   status: 200,
//   json: () => Promise.resolve({}),
// };
/**
 * Token page - placeholder for token management
 */
// export default  function TokenPage(props: TokenProps) {
  export default function TokenPage() {
  const { t } = useTranslation();
  // const address = props.address;
  const { address } = useParams<{ address: string }>();
  const [chartData, setChartData] = useState<ResType>([]);

  useEffect(() => {
    if (!address) return;
    (async () => {
      // const response = await $get({
      //   param: {
      //     address: address,
      //   },
      // });
      // if (response.status == 200) {
      //   const data = await response.json();
      //   setChartData(data);
      // } 
      try {
        const response = await $get({
          param: {
            address: address,
          },
        });
        if (response.status == 200) {
          const data = await response.json();
          setChartData(data);
        }
      } catch (error) {
        console.error('Failed to fetch token data:', error);
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
              {/* <TokenPriceChart data={chartData} height={400} /> */}
              {address ? (
                <TokenPriceChart data={chartData} height={400} />
              ) : (
                <p style={{ color: "var(--cds-text-secondary)" }}>
                  {t("tokens.noAddress", "Please provide a token address in the URL")}
                </p>
              )}
            </Tile>
          </Column>
        </Grid>
      </main>
    </div>
    </PageWrapper>
  );
}
