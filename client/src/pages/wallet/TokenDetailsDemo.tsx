import client from "@/api/main";
import { TimeSeriesLineChart } from "@/components/charts/TimeSeriesLineChart";
import { CpyBtn } from "@/components/CpyBtn";
import { FilterSwitch } from "@/components/FilterSwitch";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import { cds } from "@/util/carbon-theme";
import { Column, Grid, IconButton, Link, Stack, Tooltip } from "@carbon/react";
import { ChartAverage, Launch } from "@carbon/react/icons";
import { useMemo, useState } from "react";
import { useParams } from "react-router";

type TokenAverageTradePriceProps = {
  walletAddress: string;
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
  walletAddress,
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
      select: (data) => {
        return data.map((dataPoint) => ({
          unixTimeMs: dataPoint.unixTimestampMs,
          value: dataPoint.price,
        }));
      },
    },
  );
  const recentTrades = useGet(
    client.api.wallets[":walletAddress"].trades[":tokenAddress"],
    200,
    {
      param: {
        walletAddress,
        tokenAddress,
      },
    },
  );

  const recentTradesRows = useMemo(() => {
    if (!recentTrades.data) return [];

    return recentTrades.data.map((trade, index) => {
      const isBuy = trade.tradeAction == "buy";
      const amount = isBuy ? trade.baseAmount : trade.quoteAmount;
      const symbol = tokenSymbol;

      return {
        id: index.toString(),
        time: fmt.datetime.relativeShort(trade.blockUnixTimeMs, true),
        tradeAction: (
          <span
            style={{
              color: isBuy ? cds.supportSuccess : cds.supportError,
              textTransform: "uppercase",
            }}
          >
            {isBuy ? "Buy" : "Sell"}
          </span>
        ),
        amount: fmt.num.compact.unit(amount, symbol?.toUpperCase() || null),
        value: fmt.num.compact.currency(trade.volumeUsd),
        exchange: trade.exchangeName || "Unknown",
        transaction: (
          <IconButton
            href={`${SOLSCAN_TX_URL}/${trade.transactionHash}`}
            label="Open in Solscan"
            kind="ghost"
            size="sm"
          >
            <Launch size={18} />
          </IconButton>
        ),
      };
    });
  }, [recentTrades.data, fmt]);

  return (
    <Stack>
      <Grid narrow className={overwriteStyles.grdNarrowCustom}>
        <Column sm={2} md={2} lg={4}>
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

        <Column sm={1} md={3} lg={6}>
          <Txt size="xl" center stretch>
            {fmt.num.currency(tokenCurrentPrice)}
          </Txt>
        </Column>

        <Column sm={1} md={3} lg={6}>
          <div
            style={{
              display: "flex",
              width: "100%",
              height: "100%",
              justifyContent: "end",
              alignItems: "center",
            }}
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
      <Tble
        title={"Recent trades"}
        description={"Recent trades on this token"}
        loading={recentTrades.isLoading}
        rows={recentTradesRows}
        headers={[
          { key: "time", header: "Time", align: "start" },
          { key: "tradeAction", header: "Action", align: "center" },
          { key: "amount", header: "Amount", align: "end", width: "20%" },
          { key: "value", header: "Value (USD)", align: "end" },
          { key: "exchange", header: "Exchange", align: "start" },
          { key: "transaction", header: "Transaction", align: "center" },
        ]}
        boxed
        enablePagination
        pageSize={8}
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

  const { tr, lang, fmt } = useLocalization();

  const walletTokenDetails = useGet(
    client.api.wallets[":address"].tokens,
    200,
    {
      param: { address: address || "" },
    },
    {
      enabled: !!address,
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
          <p>{fmt.num.compact.currency(details.avgBuyCost)}</p>
          <p>{fmt.num.compact.currency(details.avgSellCost)}</p>
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

  if (!address) {
    return <></>;
  }

  return (
    <PageWrapper
      extraHeaderPanel={{
        isOpen: !!selectedToken,
        content: selectedToken && (
          <TokenAverageTradePrice
            walletAddress={address}
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
        height={800}
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
