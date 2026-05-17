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
import { Layer, MultiSelect, Tag } from "@carbon/react";
import { TknImg } from "@/components/TknImg";
import { ChartWrapper } from "../shared";
import overwriteStyles from "@/styles/_overwrite.module.scss";

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
  const [selectedTokens, setSelectedTokens] = useState<string[] | null>(null);

  const portfolio = useGet(client.api.wallets.portfolio, 200, {
    query: {
      address,
    },
  });

  const totalBalance = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        timePeriod: timePeriod,
        wallets: address,
      },
    },
    {
      select: (data) => ({
        key: "total-balance",
        label: "Total Balance",
        data: data.series
          .filter(
            (series) => series.unit == "USD" && series.seriesType == "line",
          )[0]
          .data.map((point) => ({
            unixTimeMs: point.timestamp,
            value: point.value,
          })),
      }),
    },
  );

  const tokenBalances = useGet(
    client.api.charts.balance,
    200,
    {
      query: {
        timePeriod,
        wallets: address,
        tokens: selectedTokens?.join(",") || undefined,
      },
    },
    {
      enabled: !!portfolio.data && selectedTokens != null && selectedTokens.length > 0,
      select: (data) =>
        [
          ...new Map(
            data.series
              .filter(
                (series) => series.unit == "USD" && series.seriesType == "bar",
              )
              .map((series) => [series.name, series]),
          ).values(),
        ].map((series, index) => ({
          key: String(index),
          label: series.name,
          data: series.data.map((point) => ({
            unixTimeMs: point.timestamp,
            value: point.value,
          })),
        })),
    },
  );

  const balanceSeries =
    selectedTokens == null
      ? totalBalance.data
        ? [totalBalance.data]
        : []
      : [
        ...(tokenBalances.data ?? []),
        ...(totalBalance.data ? [totalBalance.data] : []),
      ];

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
    <ChartWrapper title={tr("charts.balanceChart.title")}>
      <Flex dir="column" gap={8}>
        <Flex justify="between" align="end">
          <Layer style={{ width: 300 }}>
            <MultiSelect
              className={overwriteStyles.smallPaddingMenuItem}
              id="token-selector"
              items={portfolio.data || []}
              label={tr("charts.balanceChart.selectTokenLabel")}
              size="lg"
              itemToElement={(account) => (
                <Flex gap={4} align="center">
                  <TknImg
                    size={25}
                    alt={account.symbol || account.tokenAddress}
                    loading={portfolio.isLoading}
                    src={account.logoUri}
                  />
                  <Txt size="md">{account.symbol || account.tokenAddress}</Txt>
                </Flex>
              )}
              selectionFeedback="top-after-reopen"
              onChange={(v) =>
                setSelectedTokens(
                  v.selectedItems?.map((item) => item.tokenAddress) || null,
                )
              }
            />
          </Layer>

          <FilterSwitch
            options={[
              { value: "7D", label: tr("charts.balanceChart.window7d") },
              { value: "30D", label: tr("charts.balanceChart.window30d") },
            ]}
            value={timePeriod}
            onChange={(v) => setTimePeriod(v)}
            width="sm"
          />
        </Flex>

        <Flex dir="row" gap={4} align="center">
          <Txt size="md" secondary>
            24h Change:
          </Txt>
          <Flex dir="row" gap={2}>
            {balanceSeries.map((series) => {
              const change = series24hChanges[series.label];

              if (!change) return null;

              return (
                <Tag size="lg" title={series.label}>
                  <Flex
                    key={series.key}
                    align="center"
                    justify="between"
                    gap={2}
                  >
                    <Txt size="sm" secondary>
                      {series.label}
                    </Txt>
                    <TrendNum
                      value={change.pct}
                      prefixes="plus-minus"
                      formatter={fmt.num.percent}
                    />

                    {/* <TrendNum
                    value={change.delta}
                    prefixes="plus-minus"
                    formatter={fmt.num.currency}
                  /> */}
                  </Flex>
                </Tag>
              );
            })}
          </Flex>
        </Flex>

        <MultiTimeSeriesLineChart
          series={balanceSeries}
          height={500}
          loading={tokenBalances.isLoading}
          valueFormatter={(val) => fmt.num.currency(val)}
        />
      </Flex>
    </ChartWrapper>
  );
}
