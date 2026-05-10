import client from "@/api/main.ts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { MultiTimeSeriesLineChart } from "../MultiTimeSeriesLineChart";
import { FilterSwitch } from "@/components/FilterSwitch";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { useState, useMemo } from "react";
import { Flex } from "@/components/Flex";
import { ONE_DAY_MS } from "@/config/constants";

// TODO: Design - clarify how many days of approximation is acceptable for "24h" change label
type ChangeMetric = {
  pct: number;
  delta: number;
};

type TimeSeriesDataPoint = {
  unixTimeMs: number;
  value: number;
};

function compute24hChange(points: TimeSeriesDataPoint[]): ChangeMetric | null {
  if (points.length < 2) return null;

  const latest = points[points.length - 1];
  const targetTimestamp = latest.unixTimeMs - ONE_DAY_MS;

  const baselineCandidates = points.filter(
    (p) => p.unixTimeMs <= targetTimestamp,
  );
  const baseline =
    baselineCandidates.length > 0
      ? baselineCandidates[baselineCandidates.length - 1]
      : points[points.length - 2];

  if (!baseline || baseline.value == 0) return null;

  const pct = ((latest.value - baseline.value) / baseline.value) * 100;
  const delta = latest.value - baseline.value;

  return {
    pct,
    delta,
  };
}

export function BalanceChartV2({ address }: { address: string }) {
  const { tr, fmt } = useLocalization();

  const [timePeriod, setTimePeriod] = useState<"7D" | "30D">("30D");

  const balance = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        timePeriod: timePeriod,
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

  const portfolio = useGet(client.api.wallets.portfolio, 200, {
    query: {
      address,
    },
  });

  const tokenBalances = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        timePeriod: "30D",
        wallets: address,
        tokens:
          portfolio.data?.map((account) => account.tokenAddress).join(",") ||
          "",
      },
    },
    {
      enabled: !!portfolio.data,
      select: (data) =>
        data.series
          .filter(
            (series) => series.unit == "USD" && series.seriesType == "line",
          )
          .map((series, index) => ({
            key: String(index),
            label: series.name,
            data: series.data.map((point) => ({
              unixTimeMs: point.timestamp,
              value: point.value,
            })),
          })),
    },
  );

  const change24h = useMemo(
    () => (balance.data ? compute24hChange(balance.data) : null),
    [balance.data],
  );

  return (
    <Flex dir="column" gap={1}>
      <Flex justify="end" gap={1}>
        <FilterSwitch
          options={[
            { value: "7D", label: "7D" },
            { value: "30D", label: "30D" },
          ]}
          value={timePeriod}
          onChange={(v) => setTimePeriod(v)}
          width="sm"
        />
      </Flex>

      {change24h && (
        <Flex align="center" gap={4}>
          <Txt size="md" secondary>
            24h
          </Txt>
          <Flex gap={4}>
            <TrendNum
              value={change24h.pct}
              prefixes="plus-minus"
              formatter={fmt.num.percent}
            />
            <TrendNum
              value={change24h.delta}
              prefixes="none"
              formatter={fmt.num.currency}
            />
          </Flex>
        </Flex>
      )}

      <MultiTimeSeriesLineChart
        series={tokenBalances.data}
        height={500}
        loading={balance.isLoading}
        valueFormatter={(val) => fmt.num.currency(val)}
      />
    </Flex>
  );
}
