import client from "@/api/main.ts";
import { FilterSwitch } from "@/components/FilterSwitch";
import { Flex } from "@/components/Flex";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { ONE_DAY_MS } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet, UseGetResp } from "@/hooks/useGet";
import { Button } from "@carbon/react";
import { useMemo, useState } from "react";
import { MultiTimeSeriesLineChart } from "../MultiTimeSeriesLineChart";
import { ChartWrapper } from "../shared";
import { DismissibleContentTag } from "@/components/DismissibleContentTag/DismissibleContentTag";
import DropdownPanelField from "@/components/DropdownPanelField/DropdownPanelField";
import { TknImg } from "@/components/TknImg";
import SearchableListPanel from "@/components/SearchableListPanel/SearchableListPanel";
import styles from "./BalanceChartV2.module.scss";
import { Add } from "@carbon/react/icons";

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
}: {
  address: string;
  onClickDay?: (timestamp: number) => void;
  minHeight?: number;
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
            return 1;
          }
          if (a.valueUsd < b.valueUsd) {
            return -1;
          }
          if (a.amount > b.amount) {
            return 1;
          }
          return -1;
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
    >
      <Flex dir="column" gap={8}>
        <Flex justify="between" align="end">
          <Flex align="end">
            <DropdownPanelField
              style={{ inlineSize: "14rem" }}
              id="token-selector"
              titleText="Select token"
              placeholder="Search"
              initialValue={null as PortfolioToken}
              value={pendingToken}
              onValueChange={setPendingToken}
              renderValue={(token) => (
                <Flex align="center" gap={3}>
                  <TknImg size={20} src={token.logoUri} alt={token.symbol} />
                  <Txt uppercase>{token.symbol}</Txt>
                </Flex>
              )}
              renderPanel={({ setValue, closePanel }) => (
                <SearchableListPanel
                  items={portfolio.data || []}
                  getSearchableText={(token) =>
                    `${token.symbol} ${token.name} ${token.tokenAddress}`
                  }
                  renderItem={(token, close) => (
                    <button
                      key={token.tokenAddress}
                      className={styles.item}
                      type="button"
                      onClick={() => {
                        setValue(token); // sets the dropdown's value and triggers onValueChange
                        close(); // closes the panel
                      }}
                    >
                      <Flex
                        justify="between"
                        align="center"
                        pInline={8}
                        pBlock={5}
                      >
                        <Flex align="center" gap={4}>
                          <TknImg
                            size={20}
                            src={token.logoUri}
                            alt={token.symbol}
                          />
                          <Txt uppercase>{token.symbol}</Txt>
                          <Flex dir="column" rowGap={1}></Flex>
                        </Flex>
                      </Flex>
                    </button>
                  )}
                  searchPlaceholder="Symbol/Name"
                  hintText="Type to search tokens"
                  emptyText="No matching tokens"
                  closePanel={closePanel}
                />
              )}
            />
            <Button
              renderIcon={Add}
              kind="primary"
              size="md"
              onClick={() => {
                if (pendingToken) {
                  setSelectedTokens((prev) =>
                    new Set(prev).add(pendingToken.tokenAddress),
                  );
                  setPendingToken(null); // clear selection
                }
              }}
            >
              Add
            </Button>
          </Flex>

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
            {tr("charts.balanceChart.change24h")}:
          </Txt>
          <Flex dir="row" gap={2}>
            {balanceSeries.map((series) => {
              const change = series24hChanges[series.label];
              if (!change) return null;

              const { delta, pct, baselineValue, currentValue } = change;

              // Determine what to display
              let displayValue: number;
              let displayFormatter: (value: number | null) => string;
              let prefixMode: "plus-minus" = "plus-minus";

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
                <DismissibleContentTag
                  key={series.key}
                  size="lg"
                  disabled={series.key == "_total"}
                  onClose={() => {
                    if (selectedTokens) {
                      const newSet = new Set(selectedTokens);
                      newSet.delete(series.key);
                      setSelectedTokens(newSet);
                    }
                  }}
                >
                  <Flex align="center" justify="start" gap={2}>
                    <Txt size="sm" secondary>
                      {series.label}
                    </Txt>
                    <TrendNum
                      value={displayValue}
                      prefixes={prefixMode}
                      size="sm"
                      formatter={displayFormatter}
                    />
                  </Flex>
                </DismissibleContentTag>
              );
            })}
          </Flex>
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
