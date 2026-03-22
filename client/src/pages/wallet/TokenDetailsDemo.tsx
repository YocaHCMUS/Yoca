import client from "@/api/main";
import { CpyBtn } from "@/components/CpyBtn";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { IconButton, Link, Stack, Tooltip } from "@carbon/react";
import { ChartAverage } from "@carbon/react/icons";
import { useMemo } from "react";
import { useParams } from "react-router";

export function TokenDetailsDemo() {
  const { address } = useParams<{
    address: string;
  }>();

  if (!address) {
    return <></>;
  }

  const { tr, fmt } = useLocalization();

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
      select: (data) =>
        Object.fromEntries(data.map((item) => [item.address, item])),
    },
  );

  const rows = useMemo(() => {
    if (!walletTokenDetails.data) return [];

    return walletTokenDetails.data.map((details) => ({
      id: details.tokenAddress,
      token: (
        <Stack orientation="horizontal" gap={2}>
          <TknImg
            size={32}
            // loading={tokenMeta.isLoading}
            src={tokenMeta.data?.[details.tokenAddress]?.imageUrl}
          />
          <Stack>
            <Stack orientation="horizontal" style={{ alignItems: "center" }}>
              <Tooltip label={details.tokenAddress} align="right-top">
                <Link style={{ fontFamily: "monospace" }}>
                  {fmt.text.address(details.tokenAddress)}
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
          <p>{fmt.num.compact.decimal("Replace me")}</p>
          <p>{fmt.num.compact.decimal(details.balanceAmount)}</p>
        </Stack>
      ),
      pnl: (
        <Stack>
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
        <Stack>
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
        <Stack>
          <p>{fmt.num.compact.currency(details.totalBoughtUsd)}</p>
          <p>{fmt.num.compact.decimal(details.totalBoughtAmount)}</p>
        </Stack>
      ),
      sell: (
        <Stack>
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
          />
          /
          <TrendNum
            value={-details.totalSellCount}
            formatter={fmt.num.compact.decimal}
            prefixes="none"
          />
        </span>
      ),
      avgTradePrice: (
        <Stack>
          <p>{fmt.num.currency(details.avgBuyCost)}</p>
          <p>{fmt.num.currency(details.avgSellCost)}</p>
        </Stack>
      ),
      tradePriceGraph: (
        <IconButton kind="ghost" label="Average trading price">
          <ChartAverage />
        </IconButton>
      ),
    }));
  }, [walletTokenDetails.data]);

  return (
    <PageWrapper>
      <Tble
        loading={walletTokenDetails.isLoading}
        title={"Tokens Last Traded"}
        description={"Tokens which recent trading activities"}
        rows={rows}
        size="xl"
        headers={[
          {
            key: "token",
            header: "Token/Last traded",
          },
          {
            key: "balance",
            header: "Balance",
          },
          {
            key: "pnl",
            header: "Profit",
          },
          {
            key: "realizedPnl",
            header: "Realized Profit",
          },
          {
            key: "unrealizedPnl",
            header: "Unrealized Profit",
          },
          {
            key: "buy",
            header: "Total Bought",
            align: "end",
          },
          {
            key: "sell",
            header: "Total Sold",
            align: "end",
          },
          {
            key: "net",
            header: "Net Value",
            align: "end",
          },
          {
            key: "tradeCount",
            header: "Transactions",
            align: "end",
          },
          {
            key: "avgTradePrice",
            header: "Avg Buy/Sell Price",
            align: "end",
          },
          {
            key: "tradePriceGraph",
            header: "",
            align: "center",
          },
        ]}
      />
    </PageWrapper>
  );
}
