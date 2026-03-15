import client from "@/api/main";
import TokenTreeMap, {
  type TokenTreeMapNode,
} from "@/components/charts/TokenTreeMap";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import {
  Column,
  ContentSwitcher,
  Grid,
  IconButton,
  Link,
  Stack,
  Switch,
  Tooltip,
} from "@carbon/react";
import { Launch } from "@carbon/react/icons";
import { useMemo } from "react";

type TradeVolumeOption = "$10k" | "$50k" | "$100k";
type TradeTimeOption = "6h" | "12h" | "24h";

interface TradeFilterOptionsProps {
  volume: TradeVolumeOption;
  time: TradeTimeOption;
  onVolumeChange: (value: TradeVolumeOption) => void;
  onTimeChange: (value: TradeTimeOption) => void;
}

interface FilterOption<T> {
  value: T;
  label: string;
}

interface FilterSwitchProps<T> {
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  tooltipLabel: string;
}

function FilterSwitch<T extends string | number>({
  value,
  options,
  onChange,
  tooltipLabel,
}: FilterSwitchProps<T>) {
  const selectedIndex = options.findIndex((opt) => opt.value == value);

  return (
    <Tooltip label={tooltipLabel} enterDelayMs={2000} align="left">
      <ContentSwitcher
        className={overwriteStyles.fltrOpt}
        onChange={({ name }) => {
          if (!name) return;
          const selected = options.find((opt) => opt.value == name);
          if (selected) {
            onChange(selected.value);
          }
        }}
        selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}
        size="sm"
        style={{ minInlineSize: 200 }}
      >
        {options.map((opt) => (
          <Switch key={opt.value} name={opt.value} text={opt.label} />
        ))}
      </ContentSwitcher>
    </Tooltip>
  );
}

function TradeFilterOptions({
  volume,
  time,
  onVolumeChange,
  onTimeChange,
}: TradeFilterOptionsProps) {
  const volumeOptions: FilterOption<TradeVolumeOption>[] = [
    { value: "$10k", label: ">$10k" },
    { value: "$50k", label: ">$50k" },
    { value: "$100k", label: ">$100k" },
  ];

  const timeOptions: FilterOption<TradeTimeOption>[] = [
    { value: "6h", label: "6h" },
    { value: "12h", label: "12h" },
    { value: "24h", label: "24h" },
  ];

  return (
    <Stack gap={3} orientation="horizontal" style={{ justifyContent: "end" }}>
      <FilterSwitch
        value={volume}
        options={volumeOptions}
        onChange={onVolumeChange}
        tooltipLabel="Trading Volume"
      />
      <FilterSwitch
        value={time}
        options={timeOptions}
        onChange={onTimeChange}
        tooltipLabel="Trading Time"
      />
    </Stack>
  );
}

export default function MarketPage() {
  const { fmt, tr } = useLocalization();

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

  const trendingTokens = useGet(client.api.tokens.trending, 200);

  const trendingAddresses = useMemo(
    () => trendingTokens.data?.map((t) => t.address).join(","),
    [trendingTokens.data],
  );

  const trendingMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: trendingAddresses || "" } },
    { enabled: !!trendingAddresses },
  );

  const trendingMarketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: trendingAddresses || "" } },
    { enabled: !!trendingAddresses },
  );

  const trendingLoading =
    trendingTokens.isLoading ||
    trendingMeta.isLoading ||
    trendingMarketData.isLoading;

  const topTraders = useGet(client.api.traders.top, 200);

  const tradersLoading = topTraders.isLoading;

  const recentTradesData = useGet(client.api.trades.recent, 200);

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
            label: tr("marketPage.price"),
            value: tokenMarket.priceUsd,
            valueFmtr: fmt.num.currency,
          },
          {
            label: tr("marketPage.change24h"),
            value: tokenMarket.priceChange24h,
            valueFmtr: fmt.num.percent,
          },
          {
            label: tr("marketPage.marketCap"),
            value: tokenMarket.marketCap,
            valueFmtr: fmt.num.currency,
          },
          {
            label: tr("marketPage.volume24h"),
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

  const topTokenRows = useMemo(() => {
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
                width={28}
                style={{ borderRadius: "50%" }}
              />
            )}

            <span>
              <Tooltip label={tokenMeta.name} align="right">
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

    return topTraders.data.map((t) => ({
      id: t.address,
      trader: (
        <Tooltip label={t.address} align="bottom-left">
          <Link href={`/wallet/${t.address}`}>{truncate(t.address)}</Link>
        </Tooltip>
      ),
      pnl: fmt.num.currency(t.pnl),
      volume: fmt.num.compact.currency(t.volume),
      trades: t.tradeCount,
    }));
  }, [topTraders.data, fmt]);

  const trendingTokenRows = useMemo(() => {
    if (!trendingTokens.data || !trendingMeta.data || !trendingMarketData.data)
      return [];
    const addressToMeta = Object.fromEntries(
      trendingMeta.data.map((m) => [m.address, m]),
    );
    const addressToMarket = trendingMarketData.data;

    return trendingTokens.data.map((token) => {
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
                width={28}
                style={{ borderRadius: "50%" }}
              />
            )}

            <span>
              <Tooltip label={tokenMeta.name} align="right">
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
  }, [trendingTokens.data, trendingMeta.data, trendingMarketData.data, fmt]);

  const recentTradesRows = useMemo(() => {
    if (!recentTradesData.data) return [];

    const truncate = (a: string) =>
      a ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;

    return recentTradesData.data.map((trade, index) => ({
      id: index.toString(),
      solscan: (
        <IconButton
          href={`${SOLSCAN_TX_URL}/${trade.transactionHash}`}
          label={tr("marketPage.openInSolscan")}
          kind="ghost"
          size="sm"
          align="bottom-right"
        >
          <Launch size={18} />
        </IconButton>
      ),
      amount: (
        <Stack>
          <span>
            {fmt.num.compact.unit(trade.baseAmount, trade.baseSymbol)}
          </span>
          <span>
            {fmt.num.compact.unit(trade.quoteAmount, trade.quoteSymbol)}
          </span>
        </Stack>
      ),
      volume: fmt.num.compact.currency(trade.volumeUsd),
      trader: (
        <Tooltip label={trade.owner} align="bottom-left">
          <Link href={`/wallet/${trade.owner}`}>{truncate(trade.owner)}</Link>
        </Tooltip>
      ),
      time: fmt.datetime.relative(trade.blockUnixTime * 1000.0),
    }));
  }, [recentTradesData.data, fmt]);

  return (
    <PageWrapper>
      <Grid narrow className={overwriteStyles.wdGrd}>
        <Column sm={2} md={8} lg={8}>
          <Tble
            title={tr("marketPage.topTokens")}
            description={tr("marketPage.topTokensDescription")}
            height={500}
            loading={loading}
            headers={[
              { key: "token", header: tr("marketPage.token") },
              { key: "price", header: tr("marketPage.price") },
              { key: "change24h", header: tr("marketPage.change24h") },
              { key: "marketCap", header: tr("marketPage.marketCap") },
              { key: "volume24h", header: tr("marketPage.volume24h") },
            ]}
            rows={topTokenRows}
            stickyHeader
          />
        </Column>
        <Column sm={2} md={8} lg={8}>
          <TokenTreeMap
            loading={loading}
            data={treeMapData}
            height={500}
            maxTrendValue={20}
          />
        </Column>
        <Column sm={2} md={8} lg={8}>
          <Tble
            title={tr("marketPage.trendingTokens")}
            description={tr("marketPage.trendingTokensDescription")}
            height={400}
            loading={trendingLoading}
            headers={[
              { key: "token", header: tr("marketPage.token") },
              { key: "price", header: tr("marketPage.price") },
              { key: "change24h", header: tr("marketPage.change24h") },
              { key: "marketCap", header: tr("marketPage.marketCap") },
              { key: "volume24h", header: tr("marketPage.volume24h") },
            ]}
            rows={trendingTokenRows}
            stickyHeader
          />
        </Column>
        <Column sm={2} md={8} lg={8}>
          <Tble
            title={tr("marketPage.profitableTraders")}
            description={tr("marketPage.topTokensDescription")}
            height={400}
            loading={tradersLoading}
            headers={[
              { key: "trader", header: tr("marketPage.trader") },
              { key: "pnl", header: tr("marketPage.profits") },
              { key: "volume", header: tr("marketPage.volume") },
              { key: "trades", header: tr("marketPage.trades") },
            ]}
            rows={traderRows}
            stickyHeader
          />
        </Column>
        <Column sm={2} md={8} lg={8}>
          <Tble
            title={tr("marketPage.recentTrades")}
            toolBar={
              <TradeFilterOptions
                volume="$10k"
                time="6h"
                onVolumeChange={() => {}}
                onTimeChange={() => {}}
              />
            }
            description={"Description"}
            height={400}
            loading={recentTradesData.isLoading}
            headers={[
              { key: "time", header: tr("marketPage.time") },
              { key: "volume", header: tr("marketPage.value") },
              { key: "amount", header: tr("marketPage.amount"), width: "150%" },
              { key: "trader", header: tr("marketPage.trader") },
              {
                key: "solscan",
                header: tr("marketPage.transaction"),
                align: "center",
              },
            ]}
            rows={recentTradesRows}
            stickyHeader
          />
        </Column>
      </Grid>
    </PageWrapper>
  );
}
