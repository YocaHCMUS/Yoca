import client from "@/api/main";
import TokenTreeMap, {
  type TokenTreeMapNode,
} from "@/components/charts/TokenTreeMap";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { Column, Grid, Stack, Tooltip } from "@carbon/react";
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

  const topTraders = useGet(client.api.traders.top, 200);

  const tradersLoading = topTraders.isLoading;

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
            gap={2}
            style={{ alignItems: "center" }}
          >
            {tokenMeta.imageUrl && (
              <img
                src={tokenMeta.imageUrl}
                alt={tokenMeta.symbol}
                width={24}
                style={{ borderRadius: "50%" }}
              />
            )}

            <span>
              <Tooltip label={tokenMeta.name}>
                <strong>{tokenMeta.symbol.toUpperCase()}</strong>
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
            formatter={fmt.num.compact.currency}
          />
        ),
        volume24h: (
          <TrendNum
            value={tokenMarket.volume24h}
            formatter={fmt.num.compact.currency}
          />
        ),
      };
    });
  }, [topTokens.data, meta.data, marketData.data, fmt]);

  const traderRows = useMemo(() => {
    if (!topTraders.data) return [];

    const truncate = (a: string) =>
      a ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;

    return topTraders.data.map((t: any) => ({
      id: t.address,
      trader: (
        <Stack
          orientation="horizontal"
          gap={2}
          style={{ alignItems: "center" }}
        >
          <strong>{t.rank}</strong>
          <span>
            <Tooltip label={t.address}>
              <a href={`/wallet/${t.address}`}>{truncate(t.address)}</a>
            </Tooltip>
          </span>
        </Stack>
      ),
      pnl: fmt.num.currency(t.pnl),
      volume: fmt.num.compact.currency(t.volume),
      trades: t.trade_count,
    }));
  }, [topTraders.data, fmt]);

  return (
    <PageWrapper>
      <Grid>
        <Column sm={2} md={8} lg={8}>
          <Tble
            height={500}
            loading={loading}
            headers={[
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
                key: "marketCap",
                header: "Market Cap",
              },
              {
                key: "volume24h",
                header: "24h Volume",
              },
            ]}
            rows={rows}
            stickyHeader
          />
        </Column>
        <Column sm={2} md={8} lg={8}>
          <TokenTreeMap loading={loading} data={treeMapData} height={500} />
        </Column>
      </Grid>
      <Grid style={{ marginTop: 16 }}>
        <Column sm={2} md={16} lg={16}>
          <h3>Top Traders</h3>
          <Tble
            height={400}
            loading={tradersLoading}
            headers={[
              { key: "trader", header: "Trader" },
              { key: "pnl", header: "PnL" },
              { key: "volume", header: "Volume" },
              { key: "trades", header: "Trades" },
            ]}
            rows={traderRows}
            stickyHeader
          />
        </Column>
      </Grid>
    </PageWrapper>
  );
}
