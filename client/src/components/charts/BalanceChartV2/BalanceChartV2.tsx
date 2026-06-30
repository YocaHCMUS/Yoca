import client from "@/api/main.ts";
import {
  ChartSelect,
  ChartTag,
  SegmentedControl,
  chartControlStyles,
} from "@/components/charts/shared/ChartControls";
import { Flex } from "@/components/Flex";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { ONE_DAY_MS } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet, UseGetResp } from "@/hooks/useGet";
import { useMemo, useState } from "react";
import { MultiTimeSeriesLineChart } from "../MultiTimeSeriesLineChart";
import { ChartWrapper } from "../shared";
import { TknImg } from "@/components/TknImg";
import styles from "./BalanceChartV2.module.scss";
import { Plus } from "lucide-react";

type TimeSeriesDataPoint = {
  unixTimeMs: number;
  value: number;
};

// TODO: Design - clarify how many days of approximation is acceptable for "24h" change label
type ChangeMetric = {
  delta: number;
  pct: number | null; // null when baseline is zero
  baselineValue: number;
  currentValue: number;
};

type TokenPortpofilo = {
  tokenAddress: string;
  symbol: string;
  name?: string;
  logoUri?: string;
  amount: number;
  valueUsd: number;
};

type BalanceSeries = {
  key: string;
  label: string;
  color?: string;
  data: {
    unixTimeMs: number;
    value: number;
  }[];
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

  if (!baseline) return null;

  const delta = latest.value - baseline.value;
  const pct = baseline.value != 0 ? (delta / baseline.value) * 100 : null;

  return {
    delta,
    pct,
    baselineValue: baseline.value,
    currentValue: latest.value,
  };
}

export function BalanceChartV2({
  address,
  onClickDay,
  minHeight = 500,
  actions,
}: {
  address: string;
  onClickDay?: (timestamp: number) => void;
  minHeight?: number;
  actions?: React.ReactNode;
}) {
  const { tr, fmt } = useLocalization();

  const [timePeriod, setTimePeriod] = useState<"7D" | "30D">("7D");
  const [selectedTokens, setSelectedTokens] = useState<Set<string> | null>(
    null,
  );

  const [pendingToken, setPendingToken] = useState<PortfolioToken>(null);

  const portfolio: UseGetResp<TokenPortpofilo[]> = useGet(
    client.api.wallets.portfolio,
    200,
    {
      query: {
        address,
      },
    },
    {
      // sort by value usd then amount -> to show valuable token balances up top
      select: (data): TokenPortpofilo[] => {
        const forSort = [...data];
        forSort.sort((a, b) => {
          if (a.valueUsd > b.valueUsd) {
            return -1;
          }
          if (a.valueUsd < b.valueUsd) {
            return 1;
          }
          if (a.amount > b.amount) {
            return -1;
          }
          if (a.amount < b.amount) {
            return 1;
          }
          return 0;
        });
        return forSort;
      },
    },
  );

  const totalBalance: UseGetResp<BalanceSeries> = useGet(
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
        key: "_total",
        label: "Total Balance",
        // Todo: tokenize me
        color: "#0f62fe",
        data:
          data?.[address]?.map((point) => ({
            unixTimeMs: point.timestampMs,
            value: point.usdValue,
          })) || [],
      }),
    },
  );

  const tokenBalances: UseGetResp<BalanceSeries[]> = useGet(
    client.api.charts.balance.tokens,
    200,
    {
      query: {
        timePeriod,
        wallet: address,
        tokens: selectedTokens ? [...selectedTokens.values()].join(",") : "",
      },
    },
    {
      enabled:
        !!portfolio.data && selectedTokens != null && selectedTokens.size > 0,
      select: (data) =>
        Object.entries(data).map(([tokenAddress, points]) => ({
          key: tokenAddress,
          label:
            portfolio.data?.find((token) => token.tokenAddress == tokenAddress)
              ?.symbol || tokenAddress,
          data:
            points?.map((p) => ({
              unixTimeMs: p.timestampMs,
              value: p.usdValue,
            })) ?? [],
        })),
    },
  );

  const balanceSeries = useMemo(() => {
    if (selectedTokens == null || selectedTokens.size == 0) {
      return totalBalance.data ? [totalBalance.data] : [];
    }
    return tokenBalances.data ?? [];
  }, [selectedTokens, totalBalance.data, tokenBalances.data]);

  const totalBalanceLoadingState = totalBalance.error
    ? {
      status: "error" as const,
      retryCount: 0,
      error: {
        code: "BALANCE_HISTORY_UNAVAILABLE",
        message:
          "Balance history is temporarily unavailable. Please try again.",
        retryable: true,
      },
    }
    : {
      status: "success" as const,
      retryCount: 0,
    };

  const series24hChanges = useMemo(() => {
    return balanceSeries.reduce<Record<string, ChangeMetric | null>>(
      (acc, series) => {
        acc[series.label] = compute24hChange(series.data);
        return acc;
      },
      {},
    );
  }, [balanceSeries]);

  type PortfolioToken = NonNullable<typeof portfolio.data>[number] | null;

  const timePeriodOptions = [
    { value: "7D", label: tr("charts.balanceChart.window7d") },
    { value: "30D", label: tr("charts.balanceChart.window30d") },
  ] as const;

  const chartActions = (
    <div className={chartControlStyles.toolbar}>
      <ChartSelect<NonNullable<PortfolioToken>>
        id="balance-token-selector"
        label="Select token"
        placeholder="Search token"
        value={pendingToken}
        items={portfolio.data ?? []}
        onChange={setPendingToken}
        getKey={(token) => token.tokenAddress}
        getSearchText={(token) =>
          `${token.symbol} ${token.name ?? ""} ${token.tokenAddress}`
        }
        renderValue={(token) => (
          <Flex align="center" gap={3}>
            <TknImg size={18} src={token.logoUri} alt={token.symbol} />
            <Txt size="sm" uppercase>
              {token.symbol}
            </Txt>
          </Flex>
        )}
        renderOption={(token) => (
          <Flex justify="between" align="center" gap={4}>
            <Flex align="center" gap={3} className={styles.tokenOptionMain}>
              <TknImg size={20} src={token.logoUri} alt={token.symbol} />
              <Flex dir="column" rowGap={1} className={styles.tokenOptionText}>
                <Txt size="md" weight="semibold" uppercase ellipsis>
                  {token.symbol}
                </Txt>
                {token.name ? (
                  <Txt size="sm" secondary ellipsis>
                    {token.name}
                  </Txt>
                ) : null}
              </Flex>
            </Flex>
            <Txt size="sm" secondary>
              {fmt.num.compact.currency(token.valueUsd)}
            </Txt>
          </Flex>
        )}
        searchPlaceholder="Symbol or name"
        emptyText="No matching tokens"
        actionIcon={Plus}
        actionLabel="Add token"
        actionDisabled={!pendingToken}
        onAction={() => {
          if (!pendingToken) return;
          setSelectedTokens((prev) => {
            const next = new Set(prev ?? []);
            next.add(pendingToken.tokenAddress);
            return next;
          });
          setPendingToken(null);
        }}
        disabled={portfolio.isLoading}
      />

      <SegmentedControl
        ariaLabel={tr("charts.timePeriod")}
        options={timePeriodOptions}
        value={timePeriod}
        onChange={setTimePeriod}
      />
      {actions}
    </div>
  );
  return (
    <ChartWrapper
      title={tr("charts.balanceChart.title")}
      wrapperMinHeight={minHeight}
      loadingState={totalBalanceLoadingState}
      onRetry={
        totalBalance.error
          ? () => {
            void totalBalance.mutate();
          }
          : undefined
      }
      enableExport={false}
      enableFullscreen={false}
      enableMiniPlayer={false}
      actions={chartActions}
    >
      <Flex dir="column" gap={8}>

        <Flex dir="row" gap={4} align="center" wrap="wrap">
          <Txt size="md" secondary>
            {tr("charts.balanceChart.change24h")}:
          </Txt>
          <div className={chartControlStyles.tagRow}>
            {balanceSeries.map((series) => {
              const change = series24hChanges[series.label];
              if (!change) return null;

              const { delta, pct, baselineValue, currentValue } = change;

              // Determine what to display
              let displayValue: number;
              let displayFormatter: (value: number | null) => string;
              const prefixMode = "plus-minus" as const;

              if (baselineValue == 0 && currentValue == 0) {
                // Special case: zero to zero -> show 0%
                displayValue = 0;
                displayFormatter = fmt.num.percent;
              } else if (baselineValue == 0 && currentValue != 0) {
                // Started from zero -> show absolute delta
                displayValue = delta;
                displayFormatter = fmt.num.currency;
              } else {
                // Normal case -> show percentage
                displayValue = pct!; // pct is non-null here
                displayFormatter = fmt.num.percent;
              }

              return (
                <ChartTag
                  key={series.key}
                  label={series.label}
                  onDismiss={
                    series.key == "_total"
                      ? undefined
                      : () => {
                        if (selectedTokens) {
                          const newSet = new Set(selectedTokens);
                          newSet.delete(series.key);
                          setSelectedTokens(newSet);
                        }
                      }
                  }
                  dismissLabel={`Remove ${series.label}`}
                  value={
                    <TrendNum
                      value={displayValue}
                      prefixes={prefixMode}
                      size="sm"
                      formatter={displayFormatter}
                    />
                  }
                />
              );
            })}
          </div>
        </Flex>

        <MultiTimeSeriesLineChart
          series={balanceSeries}
          height={minHeight}
          loading={
            totalBalance.isLoading ||
            tokenBalances.isLoading ||
            portfolio.isLoading
          }
          valueFormatter={fmt.num.compact.currency}
          onClickDay={onClickDay}
          stacked
        />
      </Flex>
    </ChartWrapper>
  );
}
