import client from "@/api/main";
import Tble from "@/components/Tble";
import { PageWrapper } from "@/components/wrapper";
import { useGet } from "@/hooks/useGet";
import { useMemo } from "react";
import { useParams } from "react-router";

export function TokenDetailsDemo() {
  const { address } = useParams<{
    address: string;
  }>();

  if (!address) {
    return <>Fuck</>;
  }

  const tokenDetails = useGet(client.api.wallets.tokens[":address"], 200, {
    param: { address },
  });

  const rows = useMemo(() => {
    if (!tokenDetails.data) return [];

    return tokenDetails.data.map((details) => ({
      id: details.tokenAddress,
      token: details.tokenAddress,
      balance: details.holding,
      pnl: details.unrealizedUsd + details.realizedProfitUsd,
      realizedPnl: details.realizedProfitUsd,
      unrealizedPnl: details.unrealizedUsd,
      bought: details.totalBoughtAmount,
      sold: details.totalSoldAmount,
      avgBuyPrice: details.avgBuyCost,
      avgSellPrice: details.avgSellCost,
    }));
  }, [tokenDetails.data]);

  return (
    <PageWrapper>
      <Tble
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
