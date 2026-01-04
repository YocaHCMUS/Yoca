import { Column, Grid, Stack } from "@carbon/react";
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import client from "../../api/main.js";
import { TimeSeriesLineChart } from "../../components/charts/TimeSeriesLineChart/index.js";
import Tble from "../../components/Tble.js";
import PageWrapper from "../../components/wrapper/PageWrapper.js";

const $getChart = client.api.tokens.markets.chart[":address"].$get;
const $getMarket = client.api.tokens.markets[":addresses"].$get;
const $getMeta = client.api.tokens.meta[":addresses"].$get;

type ChartData = InferResponseType<typeof $getChart, 200>;
type MarketData = InferResponseType<typeof $getMarket, 200>[number] | null;
type MetaData = InferResponseType<typeof $getMeta, 200>[number] | null;

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const [chartData, setChartData] = useState<ChartData>([]);
  const [marketData, setMarketData] = useState<MarketData>(null);
  const [metaData, setMetaData] = useState<MetaData>(null);
  const [loading, setLoading] = useState(true);

  if (!address) {
    return "Non existent page";
  }

  async function getChartData(tokenAddress: string) {
    try {
      const resp = await $getChart({
        param: {
          address: tokenAddress,
        },
      });

      if (resp.status == 200) {
        const data = await resp.json();
        setChartData(data);
      } else {
        console.error(`Failed to get: ${resp.status}`);
      }
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    }
  }

  async function getMarketData(tokenAddress: string) {
    try {
      const resp = await $getMarket({
        param: {
          addresses: tokenAddress,
        },
      });

      if (resp.status == 200) {
        const data = await resp.json();
        setMarketData(data[0]);
      } else {
        console.error(`Failed to get: ${resp.status}`);
      }
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    }
  }

  async function getMetaData(tokenAddress: string) {
    try {
      const resp = await $getMeta({
        param: {
          addresses: tokenAddress,
        },
      });

      if (resp.status == 200) {
        const data = await resp.json();
        setMetaData(data[0]);
      } else {
        console.error(`Failed to get: ${resp.status}`);
      }
    } catch (error) {
      console.error("Failed to fetch token data:", error);
    }
  }

  useEffect(() => {
    (async () => {
      setLoading(true);

      await getChartData(address);
      await getMarketData(address);
      await getMetaData(address);

      setLoading(false);
    })();
  }, [address]);

  if (loading || !metaData || !marketData || !chartData) {
    return "Is Loading ...";
  }

  const marketDataHeaders = [
    {
      key: "name",
      header: "Name",
    },
    {
      key: "value",
      header: "Value",
    },
  ];

  const marketDataRows = [
    {
      id: "marketCap",
      name: "Market Cap",
      value: marketData.marketCap.toLocaleString(),
    },
    {
      id: "volume24h",
      name: "24h Volume Trading Volume",
      value: marketData.volume24h.toLocaleString(),
    },
    {
      id: "circulatingSupply",
      name: "Circulating Supply",
      value: marketData.circulatingSupply.toLocaleString(),
    },
    {
      id: "totalSupply",
      name: "Total Supply",
      value: marketData.totalSupply.toLocaleString(),
    },
    {
      id: "maxSupply",
      name: "Max Supply",
      value: marketData.maxSupply
        ? marketData.maxSupply.toLocaleString()
        : "N/A",
    },
  ];

  return (
    <PageWrapper>
      <Grid>
        <Column lg={8}>
          <Stack orientation="vertical">
            <Stack orientation="horizontal">
              <img
                width={48}
                src={metaData.imageUrl ?? "https://placehold.co/48x48"}
              />
              <Stack orientation="vertical">
                <b>{metaData.name}</b>
                <em>{metaData.address}</em>
              </Stack>
            </Stack>
            <Tble
              headers={marketDataHeaders}
              loading={false}
              rows={marketDataRows}
              hideHeaders
            />
          </Stack>
        </Column>
        <Column lg={8}>
          <TimeSeriesLineChart
            data={chartData.map((chart) => ({
              unixTimeMs: chart.unixTimestampMs,
              value: chart.price,
            }))}
            title="24 Price Chart"
            height={300}
            unit="USD"
            decimals={2}
            showArea={true}
            showZoom={true}
          />
        </Column>
      </Grid>
    </PageWrapper>
  );
}
