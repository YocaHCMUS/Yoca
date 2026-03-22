import client from "@/api/main";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Link, Tooltip } from "@carbon/react";
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

  const tokenDetails = useGet(client.api.wallets.tokens[":address"], 200, {
    param: { address },
  });

  const rows = useMemo(() => {
    if (!tokenDetails.data) return [];

    return tokenDetails.data.map((details) => ({
      id: details.tokenAddress,
      token: (
        <Tooltip label={details.tokenAddress}>
          <Link>{fmt.text.address(details.tokenAddress)}</Link>
        </Tooltip>
      ),
      balance: fmt.num.decimal(details.balanceAmount),
      pnl: (
        <TrendNum
          value={details.unrealizedProfitUsd + details.realizedProfitUsd}
          formatter={fmt.num.currency}
        />
      ),
      realizedPnl: (
        <TrendNum
          value={details.realizedProfitUsd}
          formatter={fmt.num.currency}
        />
      ),
      unrealizedPnl: (
        <TrendNum
          value={details.unrealizedProfitUsd}
          formatter={fmt.num.currency}
        />
      ),
      bought: fmt.num.decimal(details.totalBoughtAmount),
      sold: fmt.num.decimal(details.totalSoldAmount),
      avgBuyPrice: fmt.num.currency(details.avgBuyCost),
      avgSellPrice: fmt.num.currency(details.avgSellCost),
    }));
  }, [tokenDetails.data]);

  return (
    <PageWrapper>
      <Tble
        title={"Tokens Last Traded"}
        description={"Tokens which recent trading activities"}
        rows={rows}
        headers={[
          {
            key: "token",
            header: "Token",
          },
          {
            key: "balance",
            header: "Balance",
          },
          {
            key: "pnl",
            header: "P&L",
          },
          {
            key: "realizedPnl",
            header: "Realized P&L",
          },
          {
            key: "unrealizedPnl",
            header: "Unrealized P&L",
          },
          {
            key: "bought",
            header: "Total Bought",
          },
          {
            key: "sold",
            header: "Total Sold",
          },
          {
            key: "avgBuyPrice",
            header: "Avg Buy Price",
          },
          {
            key: "avgSellPrice",
            header: "Avg Sell Price",
          },
        ]}
      />
    </PageWrapper>
  );
}
