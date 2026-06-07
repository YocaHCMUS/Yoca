import client from "@/api/main.ts";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { MultiTimeSeriesLineChart } from "../MultiTimeSeriesLineChart";
import { FilterSwitch } from "@/components/FilterSwitch";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { useMemo, useState } from "react";
import { Flex } from "@/components/Flex";
import { ONE_DAY_MS } from "@/config/constants";
import { Tag } from "@carbon/react";
import { ChartWrapper } from "../shared";

type ChangeMetric = {
  pct: number;
  delta: number;
};

type TimeSeriesDataPoint = {
  unixTimeMs: number;
  value: number;
};

type ChartSeries = {
  key: string;
  label: string;
  data: TimeSeriesDataPoint[];
};

function compute24hChange(points: TimeSeriesDataPoint[]): ChangeMetric | null {
  if (!points || points.length < 2) return null;

  const latest = points[points.length - 1];

  const targetTimestamp = latest.unixTimeMs - ONE_DAY_MS;

  const baselineCandidates = points.filter(
    (p) => p.unixTimeMs <= targetTimestamp,
  );

  const baseline =
    baselineCandidates.length > 0
      ? baselineCandidates[baselineCandidates.length - 1]
      : points[points.length - 2];

  if (!baseline || baseline.value == 0) {
    return null;
  }

  const pct = ((latest.value - baseline.value) / baseline.value) * 100;

  const delta = latest.value - baseline.value;

  return {
    pct,
    delta,
  };
}

type MultiWalletBalanceChartProps = {
  addresses: string[];
  showTotal?: boolean;
  show24Change?: boolean;
};

export function MultiWalletBalanceChart({
  addresses,
  showTotal = true,
  show24Change = true,
}: MultiWalletBalanceChartProps) {
  const { fmt } = useLocalization();

  const [timePeriod, setTimePeriod] = useState<"7D" | "30D">("30D");

  const balanceHistory = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        wallets: addresses.join(","),
        timePeriod,
      },
    },
    {
      enabled: addresses.length > 0,
    },
  );

  const balanceSeries = useMemo<ChartSeries[]>(() => {
    if (!balanceHistory.data) {
      return [];
    }

    const walletSeries = Object.entries(balanceHistory.data).map(
      ([wallet, points]): ChartSeries => {
        return {
          key: wallet,
          label: fmt.text.address(wallet),
          data:
            points?.map((p) => ({
              unixTimeMs: p.timestampMs,
              value: p.usdValue,
            })) || [],
        };
      },
    );

    if (!showTotal) {
      return walletSeries;
    }

    const totalSeries = {
      key: "total",
      label: "Total",
      data:
        walletSeries[0]?.data.map((_, idx) => ({
          unixTimeMs: walletSeries[0].data[idx].unixTimeMs,
          value: walletSeries.reduce(
            (sum, series) => sum + (series.data[idx]?.value ?? 0),
            0,
          ),
        })) ?? [],
    };

    return [totalSeries, ...walletSeries];
  }, [balanceHistory.data]);

  const series24hChanges = useMemo(() => {
    return balanceSeries.reduce<Record<string, ChangeMetric | null>>(
      (acc, series) => {
        acc[series.label] = compute24hChange(series.data);

        return acc;
      },
      {},
    );
  }, [balanceSeries]);

  return (
    <ChartWrapper title="Combined Balance History">
      <Flex dir="column" gap={8}>
        <Flex justify="end">
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

        <Flex dir="row" gap={4} align="center" wrap="wrap">
          {show24Change && (
            <>
              <Txt size="md" secondary>
                24h Change:
              </Txt>
              <Flex dir="row" gap={2} wrap="wrap">
                {balanceSeries.map((series) => {
                  const change = series24hChanges[series.label];

                  if (!change) {
                    return null;
                  }

                  return (
                    <Tag key={series.key} size="lg" title={series.label}>
                      <Flex align="center" justify="between" gap={2}>
                        <Txt size="sm" secondary>
                          {series.label}
                        </Txt>

                        <TrendNum
                          value={change.pct}
                          prefixes="plus-minus"
                          formatter={fmt.num.percent}
                        />
                      </Flex>
                    </Tag>
                  );
                })}
              </Flex>
            </>
          )}
        </Flex>

        <MultiTimeSeriesLineChart
          series={balanceSeries}
          height={500}
          loading={balanceHistory.isLoading}
          valueFormatter={(val) => fmt.num.currency(val)}
        />
      </Flex>
    </ChartWrapper>
  );
}
