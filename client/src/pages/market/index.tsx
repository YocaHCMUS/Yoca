import client from "@/api/main";
import TokenTreeMap, {
  type TokenTreeMapNode,
} from "@/components/charts/TokenTreeMap";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { ELLIPSIS } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Stack, Tooltip } from "@carbon/react";
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

  const treeMapData = useMemo<TokenTreeMapNode[]>(() => {
    if (!topTokens.data || !meta.data || !marketData.data) return [];

    const addressToMeta = Object.fromEntries(
      meta.data.map((m) => [m.address, m]),
    );
    const addressToMarket = marketData.data;

    const data = topTokens.data.map((token) => {
      const tokenMeta = addressToMeta[token.address];
      const tokenMarket = addressToMarket[token.address];

      return {
        imgUrl: tokenMeta.imageUrl || "",
        symbol: tokenMeta.symbol.toUpperCase(),
        value: tokenMarket.marketCap,
        tooltips: [
          {
            label: "Price",
            value: tokenMarket.priceUsd,
            valueFmtr: fmt.num.currency,
          },
          {
            label: "24h Price",
            value: tokenMarket.priceChange24h,
            valueFmtr: fmt.num.percent,
          },
          {
            label: "Market Cap",
            value: tokenMarket.marketCap,
            valueFmtr: fmt.num.currency,
          },
          {
            label: "24h Volume",
            value: tokenMarket.volume24h,
            valueFmtr: fmt.num.currency,
          },
        ],
        trendValue: tokenMarket.priceChange24h,
        trendValueFmtr: fmt.num.percent,
        link: `/token/${token.address}`,
      };
    });

    return data;
  }, [topTokens.data, meta.data, marketData.data, fmt]);

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
              <Tooltip label={tokenMeta.name}>
                <small>
                  {" - "}
                  {tokenMeta.name.length > 30
                    ? tokenMeta.name.slice(0, 30) + ELLIPSIS
                    : tokenMeta.name}
                </small>
              </Tooltip>
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
  }, [topTokens.data, meta.data, marketData.data, fmt]);

  return (
    <PageWrapper>
      <TokenTreeMap loading={loading} data={treeMapData} height={500} />
      <Tble
        loading={loading}
        headers={[
          {
            key: "rank",
            header: "#",
          },
          {
            key: "token",
            header: "Token",
          },
          {
            key: "price",
            header: "Price",
          },
          {
            key: "change24h",
            header: "24h %",
          },
          {
            key: "change7d",
            header: "7d %",
          },
          {
            key: "change30d",
            header: "30d %",
          },
          {
            key: "marketCap",
            header: "Market Cap",
          },
          {
            key: "volume24h",
            header: "24h Volume",
          },
        ]}
        rows={rows}
      />
    </PageWrapper>
  );
}
