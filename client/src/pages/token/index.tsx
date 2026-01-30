import { Column, Grid } from "@carbon/react";
import { useParams } from "react-router";
import PageWrapper from "../../components/wrapper/PageWrapper";
import {
  TokenHeader,
  MarketStats,
  PriceChart,
  TopPools,
} from "../../components/token";
import { useTokenPageData } from "../../hooks/useTokenPageData";

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const { chartData, marketData, metaData, poolsData, loading } =
    useTokenPageData(address);

  if (!address) {
    return "Non existent page";
  }

  if (loading || !metaData || !marketData || !chartData) {
    return "Is Loading ...";
  }

  return (
    <PageWrapper>
      <Grid>
        <Column lg={8}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <TokenHeader
              name={metaData.name}
              address={metaData.address}
              imageUrl={metaData.imageUrl ?? undefined}
            />
            <MarketStats data={marketData} />
          </div>
        </Column>
        <Column lg={8}>
          <PriceChart
            data={chartData.map((chart) => ({
              unixTimeMs: chart.unixTimestampMs,
              value: chart.price,
            }))}
          />
        </Column>
      </Grid>

      {/* Top Pools Section */}
      <TopPools pools={poolsData} tokenAddress={address} />
    </PageWrapper>
  );
}
