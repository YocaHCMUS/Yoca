import client from "@/api/main";
import SparklineChart from "@/components/charts/SparklineChart";
import TokenTreeMap, {
  type TokenTreeMapNode,
} from "@/components/charts/TokenTreeMap";
import { CpyBtn } from "@/components/CpyBtn";
import { FilterSwitch } from "@/components/FilterSwitch";
import { ModalStateManager } from "@/components/ModelStateManager";
import Tble from "@/components/Tble";
import { TknImg } from "@/components/TknImg";
import { TrendNum } from "@/components/TrendNum";
import { Txt } from "@/components/Txt";
import { PageWrapper } from "@/components/wrapper";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import { cds } from "@/util/carbon-theme";
import {
  Button,
  Column,
  Grid,
  IconButton,
  Link,
  Modal,
  Section,
  Stack,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tooltip,
} from "@carbon/react";
import { ChartTreemap, Launch, Star, StarFilled } from "@carbon/react/icons";
import { useEffect, useMemo, useState } from "react";

type TradeVolumeOption = 0 | 1 | 100 | 500;
type TradeTimeOption = "6h" | "12h" | "24h";
type TradesSortOption = "volume" | "time";

export default function MarketPage() {
  const { fmt, tr } = useLocalization();
  const [tradeVolume, setTradeVolume] = useState<TradeVolumeOption>(1);
  const [tradeTime, setTradeTime] = useState<TradeTimeOption>("24h");
  const [tradesSort, setTradesSort] = useState<TradesSortOption>("volume");
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  const [watchlist, setWatchlist] = useState<string[]>(() => {
    const saved = localStorage.getItem("yoca_watchlist");
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem("yoca_watchlist", JSON.stringify(watchlist));
  }, [watchlist]);

  const toggleWatchlist = (address: string) => {
    setWatchlist((prev) =>
      prev.includes(address)
        ? prev.filter((a) => a !== address)
        : [...prev, address],
    );
  };

  const headings = useMemo(() => {
    const map = {
      0: {
        title: tr("marketPage.allTokensTitle"),
        subtitle: tr("marketPage.allTokensSubtitle"),
      },
      1: {
        title: tr("marketPage.watchlistTitle"),
        subtitle: tr("marketPage.watchlistSubtitle"),
      },
      2: {
        title: tr("marketPage.tradesTitle"),
        subtitle: tr("marketPage.tradesSubtitle"),
      },
    };
    return map[activeTabIndex as keyof typeof map] || map[0];
  }, [activeTabIndex, tr]);

  const topTokens = useGet(client.api.tokens["top-marketcap"], 200);
  const addresses = useMemo(
    () => topTokens.data?.map((t) => t.address).join(","),
    [topTokens.data],
  );
  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: addresses || "" } },
    {
      enabled: !!addresses,
      select: (data) => Object.fromEntries(data.map((m) => [m.address, m])),
    },
  );
  const marketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: addresses || "" } },
    { enabled: !!addresses },
  );
  const topGainers = useGet(client.api.trades.traders.gainers, 200);
  const topLosers = useGet(client.api.trades.traders.losers, 200);
  const recentTradesData = useGet(client.api.trades.recent, 200, {
    query: {
      timeWindow: tradeTime,
      usdThreshold: Number(tradeVolume),
      sortBy: tradesSort,
    },
  });

  const loading =
    topTokens.isLoading || tokenMeta.isLoading || marketData.isLoading;

  const tokenHeaders = [
    { key: "favorite", header: "", width: 56, align: "center" as const },
    { key: "token", header: tr("marketPage.token"), align: "start" as const },
    { key: "price", header: tr("marketPage.price"), align: "end" as const },
    { key: "change1h", header: "1h", align: "end" as const },
    { key: "change24h", header: "24h", align: "end" as const },
    { key: "change7d", header: "7d", align: "end" as const },
    {
      key: "volume24h",
      header: tr("marketPage.volume24h"),
      align: "end" as const,
    },
    {
      key: "marketCap",
      header: tr("marketPage.marketCap"),
      align: "end" as const,
    },
    { key: "fdv", header: tr("token.marketStats.fdv"), align: "end" as const },
    {
      key: "sparkline",
      header: tr("nav.searchLast7Days"),
      align: "end" as const,
      width: "15%",
    },
  ];

  const traderHeaders = [
    { key: "trader", header: tr("marketPage.trader"), align: "start" as const },
    { key: "pnl", header: tr("marketPage.profits"), align: "end" as const },
    { key: "volume", header: tr("marketPage.volume"), align: "end" as const },
    {
      key: "trades",
      header: tr("marketPage.trades"),
      align: "center" as const,
    },
  ];

  const recentTradesHeaders = [
    { key: "time", header: tr("marketPage.time"), align: "start" as const },
    { key: "volume", header: tr("marketPage.value"), align: "end" as const },
    { key: "amount", header: tr("marketPage.amount"), align: "end" as const },
    { key: "trader", header: tr("marketPage.trader"), align: "end" as const },
    {
      key: "solscan",
      header: tr("marketPage.transaction"),
      align: "center" as const,
    },
  ];

  const treeMapData = useMemo<TokenTreeMapNode[]>(() => {
    if (!topTokens.data || !tokenMeta.data || !marketData.data) return [];

    return topTokens.data.map((token) => {
      const m = tokenMeta.data![token.address];
      const mk = marketData.data![token.address];
      return {
        imgUrl: m.imageUrl || "",
        symbol: m.symbol.toUpperCase(),
        value: mk.marketCap,
        tooltips: [
          {
            label: tr("marketPage.price"),
            value: mk.priceUsd,
            valueFmtr: fmt.num.currency,
          },
          {
            label: tr("marketPage.change24h"),
            value: mk.priceChange24h,
            valueFmtr: fmt.num.percent,
          },
        ],
        trendValue: mk.priceChange24h,
        trendValueFmtr: fmt.num.percent,
        link: `/tokens/${token.address}`,
      };
    });
  }, [topTokens.data, tokenMeta.data, marketData.data, fmt, tr]);

  const topTokenRows = useMemo(() => {
    if (!topTokens.data || !tokenMeta.data || !marketData.data) return [];

    return topTokens.data.map((token) => {
      const m = tokenMeta.data![token.address];
      const mk = marketData.data![token.address];
      const isFav = watchlist.includes(token.address);
      return {
        id: token.address,
        favorite: (
          <IconButton
            label={
              isFav
                ? tr("marketPage.removeFromWatchlist")
                : tr("marketPage.addToWatchlist")
            }
            kind="ghost"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWatchlist(token.address);
            }}
          >
            {isFav ? (
              <StarFilled size={18} fill={cds.backgroundBrand} />
            ) : (
              <Star size={18} />
            )}
          </IconButton>
        ),
        token: (
          <Stack
            orientation="horizontal"
            gap={2}
            style={{ alignItems: "center" }}
          >
            <TknImg src={m.imageUrl} alt={m.symbol} size={28} />
            <Stack gap={1} style={{ justifyContent: "center" }}>
              <Stack
                orientation="horizontal"
                gap={2}
                style={{ alignItems: "center" }}
              >
                <Link
                  href={`/tokens/${token.address}`}
                  style={{ fontFamily: "monospace" }}
                >
                  {m.symbol.toUpperCase()}
                </Link>
                <CpyBtn size="xs" copyWhat={token.address} />
              </Stack>
              <Tooltip label={m.name}>
                <Txt secondary ellipsis>
                  {(m.name ?? "").length > 10
                    ? `${m.name.slice(0, 10)}…`
                    : m.name}
                </Txt>
              </Tooltip>
            </Stack>
          </Stack>
        ),
        price: fmt.num.currency(mk.priceUsd),
        change1h: (
          <TrendNum
            value={mk.priceChangePercentage1h}
            formatter={fmt.num.percent}
          />
        ),
        change24h: (
          <TrendNum
            value={mk.priceChangePercentage24h}
            formatter={fmt.num.percent}
          />
        ),
        change7d: (
          <TrendNum
            value={mk.priceChangePercentage7d}
            formatter={fmt.num.percent}
          />
        ),
        volume24h: fmt.num.compact.currency(mk.volume24h),
        marketCap: fmt.num.compact.currency(mk.marketCap),
        fdv: fmt.num.compact.currency(mk.fullyDilutedValuation),
        sparkline: (
          <div style={{ width: "100%", height: 40, paddingLeft: 24 }}>
            <SparklineChart
              data={mk.sparkline7d ?? []}
              positive={(mk.priceChangePercentage7d ?? 0) >= 0}
            />
          </div>
        ),
      };
    });
  }, [topTokens.data, tokenMeta.data, marketData.data, fmt, watchlist, tr]);

  const traderRows = (data: NonNullable<typeof topGainers.data>) =>
    data.map((t) => ({
      id: t.address,
      trader: (
        <Stack
          orientation="horizontal"
          gap={1}
          style={{ alignItems: "center" }}
        >
          <Link href={`/wallet/${t.address}`}>
            {fmt.text.address(t.address)}
          </Link>
          <CpyBtn size="xs" copyWhat={t.address} />
        </Stack>
      ),
      pnl: (
        <TrendNum
          value={t.pnl}
          formatter={fmt.num.compact.currency}
          prefixes="plus-minus"
        />
      ),
      volume: fmt.num.compact.currency(t.volume),
      trades: t.tradeCount,
    }));

  const mapRecentTrades = useMemo(() => {
    if (!recentTradesData.data) return [];
    return recentTradesData.data.map((trade, index) => {
      const isBuy = trade.tradeAction == "buy";
      const baseSymbol = tokenMeta.data?.[trade.baseAddress]?.symbol || null;
      const quoteSymbol = tokenMeta.data?.[trade.quoteAddress]?.symbol || null;

      const buyAmount = isBuy ? trade.baseAmount : trade.quoteAmount;
      const buySymbol = isBuy ? baseSymbol : quoteSymbol;
      const sellAmount = isBuy ? trade.quoteAmount : trade.baseAmount;
      const sellSymbol = isBuy ? quoteSymbol : baseSymbol;

      return {
        id: index.toString(),
        solscan: (
          <IconButton
            href={`${SOLSCAN_TX_URL}/${trade.transactionHash}`}
            label={tr("marketPage.openInSolscan")}
            kind="ghost"
            size="sm"
          >
            <Launch size={18} />
          </IconButton>
        ),
        amount: (
          <Stack gap={1}>
            <span
              style={{ color: isBuy ? cds.supportSuccess : cds.supportError }}
            >
              {fmt.num.compact.decimal(buyAmount)} {buySymbol}
            </span>
            <Txt secondary>
              {fmt.num.compact.decimal(sellAmount)} {sellSymbol}
            </Txt>
          </Stack>
        ),
        volume: fmt.num.compact.currency(trade.volumeUsd),
        trader: (
          <Link href={`/wallet/${trade.owner}`}>
            {fmt.text.address(trade.owner)}
          </Link>
        ),
        time: fmt.datetime.relative(trade.blockUnixTime * 1000.0),
      };
    });
  }, [recentTradesData.data, fmt, tr]);

  return (
    <PageWrapper>
      <Section>
        <Grid className={overwriteStyles.wdGrd}>
          <Column sm={2} md={8} lg={16}>
            <Stack gap={4}>
              <Stack gap={1}>
                <Txt bold size="lg">
                  {headings.title}
                </Txt>
                <Txt secondary>{headings.subtitle}</Txt>
              </Stack>
              <Tabs
                onChange={({ selectedIndex }) =>
                  setActiveTabIndex(selectedIndex)
                }
              >
                <Stack
                  orientation="horizontal"
                  style={{
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <TabList aria-label="Market Navigation">
                    <Tab>All</Tab>
                    <Tab>Watchlist</Tab>
                    <Tab>Trades</Tab>
                  </TabList>
                  <ModalStateManager
                    renderLauncher={({ setOpen }) => (
                      <Button
                        kind="ghost"
                        onClick={() => setOpen(true)}
                        renderIcon={ChartTreemap}
                      >
                        {tr("marketPage.marketMap")}
                      </Button>
                    )}
                  >
                    {({ open, setOpen }) => (
                      <Modal
                        open={open}
                        onRequestClose={() => setOpen(false)}
                        modalHeading={tr("marketPage.marketMap")}
                        passiveModal
                        size="md"
                      >
                        <TokenTreeMap
                          loading={loading}
                          data={treeMapData}
                          height={400}
                          maxTrendValue={20}
                        />
                      </Modal>
                    )}
                  </ModalStateManager>
                </Stack>
                <TabPanels>
                  <TabPanel>
                    <Tble
                      loading={loading}
                      headers={tokenHeaders}
                      rows={topTokenRows}
                    />
                  </TabPanel>
                  <TabPanel>
                    <Tble
                      loading={loading}
                      headers={tokenHeaders}
                      rows={topTokenRows.filter((r) =>
                        watchlist.includes(r.id),
                      )}
                    />
                  </TabPanel>
                  <TabPanel>
                    <Grid narrow>
                      <Column lg={8} md={8} sm={4}>
                        <Tble
                          boxed
                          stickyHeader
                          title={tr("marketPage.topGainers")}
                          height={500}
                          loading={topGainers.isLoading}
                          headers={traderHeaders}
                          rows={traderRows(topGainers.data || [])}
                        />
                      </Column>
                      <Column lg={8} md={8} sm={4}>
                        <Tble
                          boxed
                          stickyHeader
                          title={tr("marketPage.topLosers")}
                          height={500}
                          loading={topLosers.isLoading}
                          headers={traderHeaders}
                          rows={traderRows(topLosers.data || [])}
                        />
                      </Column>
                      <Column lg={16} md={8} sm={4}>
                        <Tble
                          boxed
                          stickyHeader
                          enablePagination
                          title={tr("marketPage.recentTrades")}
                          height={500}
                          loading={recentTradesData.isLoading}
                          rows={mapRecentTrades}
                          headers={recentTradesHeaders}
                          marginTop={16}
                          toolBar={
                            <>
                              <FilterSwitch
                                width="lg"
                                options={[
                                  {
                                    value: 0,
                                    label: tr("marketPage.filterAll"),
                                  },
                                  {
                                    value: 1,
                                    label: tr("marketPage.filterGreaterThan", {
                                      val: "1",
                                    }),
                                  },
                                  {
                                    value: 100,
                                    label: tr("marketPage.filterGreaterThan", {
                                      val: "100",
                                    }),
                                  },
                                  {
                                    value: 500,
                                    label: tr("marketPage.filterGreaterThan", {
                                      val: "500",
                                    }),
                                  },
                                ]}
                                value={tradeVolume}
                                onChange={(v) => setTradeVolume(v)}
                              />
                              <FilterSwitch
                                options={[
                                  { value: "6h", label: "6h" },
                                  { value: "12h", label: "12h" },
                                  { value: "24h", label: "24h" },
                                ]}
                                value={tradeTime}
                                onChange={(v) => setTradeTime(v)}
                              />
                              <FilterSwitch
                                options={[
                                  {
                                    value: "volume",
                                    label: tr("marketPage.volume"),
                                  },
                                  {
                                    value: "time",
                                    label: tr("marketPage.time"),
                                  },
                                ]}
                                value={tradesSort}
                                onChange={(v) => setTradesSort(v)}
                              />
                            </>
                          }
                        />
                      </Column>
                    </Grid>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </Stack>
          </Column>
        </Grid>
      </Section>
    </PageWrapper>
  );
}
