import client from "@/api/main.ts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { TimeSeriesLineChart } from "../TimeSeriesLineChart";

export function BalanceChartV2({ address }: { address: string }) {
  const { tr, fmt } = useLocalization();
  console.log("re-render");
  const balance = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        timePeriod: "All",
        wallets: address,
      },
    },
    {
      select: (data) =>
        data.series
          .filter(
            (series) => series.unit == "USD" && series.seriesType == "line",
          )
          .at(0)
          ?.data.map((point) => ({
            unixTimeMs: point.timestamp,
            value: point.value,
          })),
    },
  );

  if (balance.isLoading) {
    console.log("is loading");
    return <>loadding</>;
  }
  if (!balance.data) {
    console.log("data");
    return <>no data</>;
  }

  return <TimeSeriesLineChart data={balance.data} height={500} />;
}
