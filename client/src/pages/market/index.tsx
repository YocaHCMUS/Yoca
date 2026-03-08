import client from "@/api/main";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Stack } from "@carbon/react";
import { useMemo } from "react";

export default function MarketPage() {
  const { fmt } = useLocalization();

  const topTokens = useGet(client.api.tokens["top-marketcap"], 200);

  const addresses = useMemo(
    () => topTokens.data?.map((t) => t.address).join(","),
    [topTokens.data],
  );

  const meta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: addresses || "" } },
    { enabled: !!addresses },
  );

  const marketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: addresses || "" } },
    { enabled: !!addresses },
  );

  const loading = topTokens.isLoading || meta.isLoading || marketData.isLoading;

  const rows = useMemo(() => {
    if (!topTokens.data || !meta.data || !marketData.data) return [];
    const addressToMeta = Object.fromEntries(
      meta.data.map((m) => [m.address, m]),
    );
    const addressToMarket = marketData.data;

    return topTokens.data.map((token) => {
      const tokenMeta = addressToMeta[token.address];
      const tokenMarket = addressToMarket[token.address];

      return {
        id: token.address,
        rank: token.rank,
        token: (
          <Stack
            orientation="horizontal"
            gap={4}
            style={{ alignItems: "center" }}
          >
            {tokenMeta.imageUrl && (
              <img
                src={tokenMeta.imageUrl}
                alt={tokenMeta.symbol}
                style={{ width: "24px", height: "24px", borderRadius: "50%" }}
              />
            )}
            <span>
              <strong>{tokenMeta.symbol.toUpperCase()}</strong>
              <small>- {tokenMeta.name}</small>
            </span>
          </Stack>
        ),
        price: fmt.num.currency(tokenMarket.priceUsd),
        change24h: (
          <TrendNum
            value={tokenMarket.priceChange24h}
            formatter={fmt.num.percent}
          />
        ),
        change7d: (
          <TrendNum
            value={tokenMarket.priceChangePercentage7d}
            formatter={fmt.num.percent}
          />
        ),
        change30d: (
          <TrendNum
            value={tokenMarket.priceChangePercentage30d}
            formatter={fmt.num.percent}
          />
        ),
        marketCap: (
          <TrendNum
            value={tokenMarket.marketCap}
            formatter={fmt.num.currency}
          />
        ),
        volume24h: (
          <TrendNum
            value={tokenMarket.volume24h}
            formatter={fmt.num.currency}
          />
        ),
      };
    });
  }, [topTokens.data, meta.data, marketData.data]);

  return (
    <PageWrapper>
      <Tble
        loading={loading}
        headers={[
          {
            key: "rank",
            header: "#",
            style: { width: "50px" },
          },
          {
            key: "token",
            header: "Token",
            style: { width: "200px" },
          },
          {
            key: "price",
            header: "Price",
            style: { width: "120px" },
          },
          {
            key: "change24h",
            header: "24h %",
            style: { width: "100px" },
          },
          {
            key: "change7d",
            header: "7d %",
            style: { width: "100px" },
          },
          {
            key: "change30d",
            header: "30d %",
            style: { width: "100px" },
          },
          {
            key: "marketCap",
            header: "Market Cap",
            style: { width: "150px" },
          },
          {
            key: "volume24h",
            header: "24h Volume",
            style: { width: "150px" },
          },
        ]}
        rows={rows}
      />
    </PageWrapper>
  );
}
