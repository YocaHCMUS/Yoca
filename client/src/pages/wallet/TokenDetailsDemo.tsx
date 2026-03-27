import client from "@/api/main";
import { TimeSeriesLineChart } from "@/components/charts/TimeSeriesLineChart";
import { CpyBtn } from "@/components/CpyBtn";
import { FilterSwitch } from "@/components/FilterSwitch";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { useGet } from "@/hooks/useGet";
import { cds } from "@/util/carbon-theme";
import { Column, Grid, IconButton, Link, Stack, Tooltip } from "@carbon/react";
import { ChartAverage } from "@carbon/react/icons";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

type TokenAverageTradePriceProps = {
  tokenAddress: string;
  tokenImgUrl: string | null;
  tokenSymbol: string | null;
  tokenName: string | null;
  tokenCurrentPrice: number | null;
  avgBuyPrice: number;
  avgSellPrice: number;
};

type TokenPriceDayRange = 7 | 30 | 90;

function TokenAverageTradePrice({
  tokenAddress,
  tokenImgUrl,
  tokenSymbol,
  tokenName,
  tokenCurrentPrice,
  avgBuyPrice,
  avgSellPrice,
}: TokenAverageTradePriceProps) {
  const { sellColor, buyColor } = useCarbonTokens({
    sellColor: cds.supportError,
    buyColor: cds.supportWarning,
  });
  const { fmt } = useLocalization();
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<TokenPriceDayRange>(7);

  const priceData = useGet(
    client.api.tokens.markets.chart[":address"].daily,
    200,
    {
      param: { address: tokenAddress },
      query: {
        days: selectedTimeRange,
      },
    },
    {
      select: (data) =>
        data.map((dataPoint) => ({
          unixTimeMs: dataPoint.unixTimestampMs,
          value: dataPoint.price,
        })),
    },
  );

  return (
    <Stack>
      <Grid narrow>
        <Column sm={2} md={4} lg={4}>
          <Stack
            orientation="horizontal"
            gap={3}
            style={{ justifyContent: "start", alignItems: "center" }}
          >
            <TknImg src={tokenImgUrl} alt={tokenSymbol} size={48} />
            <Stack>
              <Stack orientation="horizontal" style={{ alignItems: "center" }}>
                <Link
                  style={{
                    fontFamily: "monospace",
                    textTransform: "uppercase",
                  }}
                >
                  {tokenSymbol ??
                    fmt.text.address(tokenAddress, {
                      maxLength: 4,
                      position: "end",
                    })}
                </Link>
                <CpyBtn size="xs" copyWhat={tokenAddress} />
              </Stack>

              <Txt size="sm" secondary ellipsis>
                {tokenName}
              </Txt>
            </Stack>
          </Stack>
        </Column>

        <Column sm={1} md={2} lg={6}>
          <Txt size="xl" center stretch>
            {fmt.num.currency(tokenCurrentPrice)}
          </Txt>
        </Column>

        <Column sm={1} md={2} lg={6}>
          <div
            style={{ display: "flex", width: "100%", justifyContent: "end" }}
          >
            <FilterSwitch
              options={[
                {
                  label: "7d",
                  value: 7,
                },
                {
                  label: "30d",
                  value: 30,
                },
                {
                  label: "90d",
                  value: 90,
                },
              ]}
              value={selectedTimeRange}
              onChange={(v) => setSelectedTimeRange(v)}
            />
          </div>
        </Column>
      </Grid>

      <TimeSeriesLineChart
        markLines={[
          {
            label: "Avg Buy Price",
            value: avgBuyPrice,
            color: buyColor,
          },
          {
            label: "Avg Sell Price",
            value: avgSellPrice,
            color: sellColor,
          },
        ]}
        helper="average-buy-sell"
        valueFormatter={fmt.num.compact.currency}
        data={priceData.data}
        loading={priceData.isLoading}
      />
    </Stack>
  );
}

export function TokenDetailsDemo() {
  const { address } = useParams<{
    address: string;
  }>();

  const [selectedToken, setSelectedToken] = useState<{
    address: string;
    symbol: string;
    avgBuyCost: number;
    avgSellCost: number;
  } | null>(null);

  if (!address) {
    return <></>;
  }

  const { tr, lang, fmt } = useLocalization();

  const walletTokenDetails = useGet(
    client.api.wallets[":address"].tokens,
    200,
    {
      param: { address },
    },
  );

  const tokenAddresses = useMemo(
    () =>
      walletTokenDetails.data
        ?.map((details) => details.tokenAddress)
        .join(",") || null,
    [walletTokenDetails.data],
  );

  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    {
      enabled: !!tokenAddresses,
      select: (data) => {
        return Object.fromEntries(data.map((item) => [item.address, item]));
      },
    },
  );

  const tokenMarket = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    {
      enabled: !!tokenAddresses,
    },
  );

  const rows = useMemo(() => {
    if (!walletTokenDetails.data) return [];

    return walletTokenDetails.data.map((details) => ({
      id: details.tokenAddress,
      token: (
        <Stack
          orientation="horizontal"
          gap={2}
          style={{ alignItems: "center" }}
        >
          <TknImg
            size={42}
            loading={tokenMeta.isLoading}
            src={tokenMeta.data?.[details.tokenAddress]?.imageUrl}
          />
          <Stack>
            <Stack orientation="horizontal" style={{ alignItems: "center" }}>
              <Tooltip label={details.tokenAddress} align="right-top">
                <Link style={{ fontFamily: "monospace" }}>
                  {tokenMeta.data?.[
                    details.tokenAddress
                  ]?.symbol.toUpperCase() ??
                    fmt.text.address(details.tokenAddress, {
                      maxLength: 4,
                      position: "end",
                    })}
                </Link>
              </Tooltip>
              <CpyBtn size="xs" copyWhat={details.tokenAddress} />
            </Stack>
            <small>
              {fmt.datetime.relativeShort(
                details.lastTradeUnixTime * 1000,
                true,
              )}
            </small>
          </Stack>
        </Stack>
      ),
      balance: (
        <Stack>
          <p>
            {fmt.num.compact.currency(
              tokenMarket.data?.[details.tokenAddress]?.priceUsd
                ? tokenMarket.data?.[details.tokenAddress]?.priceUsd *
                    details.balanceAmount
                : null,
            )}
          </p>
          <p>{fmt.num.compact.decimal(details.balanceAmount)}</p>
        </Stack>
      ),
      pnl: (
        <Stack style={{ justifyContent: "inherit" }}>
          <TrendNum
            prefixes="plus-minus"
            value={details.unrealizedProfitUsd + details.realizedProfitUsd}
            formatter={fmt.num.currency}
          />
          <TrendNum
            prefixes="plus-minus"
            value={
              details.realizedProfitPercent + details.unrealizedProfitPercent
            }
            formatter={fmt.num.percent}
          />
        </Stack>
      ),
      realizedPnl: (
        <Stack style={{ justifyContent: "inherit" }}>
          <TrendNum
            prefixes="plus-minus"
            value={details.realizedProfitUsd}
            formatter={fmt.num.currency}
          />
          <TrendNum
            prefixes="plus-minus"
            value={details.realizedProfitPercent}
            formatter={fmt.num.percent}
          />
        </Stack>
      ),
      unrealizedPnl: (
        <TrendNum
          prefixes="plus-minus"
          value={details.unrealizedProfitUsd}
          formatter={fmt.num.currency}
        />
      ),
      buy: (
        <Stack style={{ justifyContent: "inherit" }}>
          <p>{fmt.num.compact.currency(details.totalBoughtUsd)}</p>
          <p>{fmt.num.compact.decimal(details.totalBoughtAmount)}</p>
        </Stack>
      ),
      sell: (
        <Stack style={{ justifyContent: "inherit" }}>
          <p>{fmt.num.compact.currency(details.totalSoldUsd)}</p>
          <p>{fmt.num.compact.decimal(details.totalSoldAmount)}</p>
        </Stack>
      ),
      net: (
        <TrendNum
          prefixes="plus-minus"
          value={details.totalSoldUsd - details.totalBoughtUsd}
          formatter={fmt.num.compact.currency}
        />
      ),
      tradeCount: (
        <span>
          <TrendNum
            value={details.totalBuyCount}
            formatter={fmt.num.compact.decimal}
            prefixes="none"
          />{" "}
          /{" "}
          <TrendNum
            value={-details.totalSellCount}
            formatter={fmt.num.compact.decimal}
            prefixes="none"
          />
        </span>
      ),
      avgTradePrice: (
        <Stack style={{ justifyContent: "inherit" }}>
          <p>{fmt.num.currency(details.avgBuyCost)}</p>
          <p>{fmt.num.currency(details.avgSellCost)}</p>
        </Stack>
      ),
      tradePriceGraph: (
        <IconButton
          kind="ghost"
          label="Average trading price"
          align="bottom-right"
          onClick={() =>
            setSelectedToken({
              address: details.tokenAddress,
              symbol:
                tokenMeta.data?.[details.tokenAddress]?.symbol.toUpperCase() ??
                "Unknown",
              avgBuyCost: details.avgBuyCost,
              avgSellCost: details.avgSellCost,
            })
          }
        >
          <ChartAverage />
        </IconButton>
      ),
    }));
  }, [
    walletTokenDetails.data,
    tokenMeta.isLoading,
    tokenMeta.data,
    tokenMarket.data,
    lang,
  ]);

  return (
    <PageWrapper
      extraHeaderPanel={{
        isOpen: !!selectedToken,
        content: selectedToken && (
          <TokenAverageTradePrice
            tokenAddress={selectedToken.address}
            tokenImgUrl={
              tokenMeta.data?.[selectedToken.address]?.imageUrl || null
            }
            tokenName={tokenMeta.data?.[selectedToken.address]?.name || null}
            tokenSymbol={
              tokenMeta.data?.[selectedToken.address]?.symbol || null
            }
            tokenCurrentPrice={
              tokenMarket.data?.[selectedToken.address]?.priceUsd || null
            }
            avgBuyPrice={selectedToken.avgBuyCost}
            avgSellPrice={selectedToken.avgSellCost}
          />
        ),
        size: "lg",
        onClose: () => setSelectedToken(null),
      }}
    >
      <Tble
        loading={walletTokenDetails.isLoading}
        boxed
        title={"Tokens Last Traded"}
        description={"Tokens which recent trading activities"}
        rows={rows}
        size="xl"
        stickyHeader
        enablePagination
        headers={[
          { key: "token", header: "Token/Last traded", align: "start" },
          { key: "balance", header: "Balance", align: "center" },
          { key: "pnl", header: "Profit" },
          { key: "realizedPnl", header: "Realized Profit" },
          { key: "unrealizedPnl", header: "Unrealized Profit" },
          { key: "buy", header: "Total Bought", align: "end" },
          { key: "sell", header: "Total Sold", align: "end" },
          { key: "net", header: "Net Value", align: "end" },
          { key: "tradeCount", header: "Transactions", align: "end" },
          { key: "avgTradePrice", header: "Avg Buy/Sell Price", align: "end" },
          { key: "tradePriceGraph", header: "Graph", align: "center" },
        ]}
      />
    </PageWrapper>
  );
}
