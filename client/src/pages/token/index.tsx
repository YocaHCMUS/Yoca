import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router";
import client from "../../api/main.js";
import { TimeSeriesLineChart } from "../../components/charts/TimeSeriesLineChart/index.js";
import PageWrapper from "../../components/wrapper/PageWrapper.js";
// interface TokenProps {
//   address: string;
// }

const $get = client.api.tokens.markets.chart[":address"].$get;
type ChartData = InferResponseType<typeof $get, 200>;

export default function TokenPage() {
  const { t } = useTranslation();
  // const address = props.address;
  const { address } = useParams<{ address: string }>();
  const [chartData, setChartData] = useState<ChartData>([]);

  if (!address) {
    return "Non existent page";
  }

  useEffect(() => {
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
        const resp = await $get({
          param: {
            address,
          },
        });
        if (resp.status == 200) {
          const data = await resp.json();
          console.log("Data: ", data);
          setChartData(data);
        } else {
          console.error(`Failed to get: ${resp.status}`);
        }
      } catch (error) {
        console.error("Failed to fetch token data:", error);
      }
    })();
  }, [address]);

  return (
    <PageWrapper>
      <TimeSeriesLineChart
        data={chartData.map((chart) => ({
          unixTimeMs: chart.unixTimestampMs,
          value: chart.price,
        }))}
        title="Hello"
        height={300}
        unit="USD"
        decimals={2}
        showArea={true}
        showZoom={true}
      />
    </PageWrapper>
  );
}
