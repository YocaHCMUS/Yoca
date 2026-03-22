import client from "@/api/main";
import TokenTreeMap, {
  type TokenTreeMapNode,
} from "@/components/charts/TokenTreeMap";
import SparklineChart from "@/components/charts/SparklineChart";
import { FilterSwitch } from "@/components/FilterSwitch";
import MarketTicker from "@/components/MarketTicker";
import Tble from "@/components/Tble";
import { TrendNum } from "@/components/TrendNum";
import { PageWrapper } from "@/components/wrapper";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import overwriteStyles from "@/styles/_overwrite.module.scss";
import semStyle from "@/styles/_semantic.module.scss";
import styles from "./index.module.scss";
import { Column, Grid, IconButton, Link, Stack, Tooltip, Modal } from "@carbon/react";
import { Star, StarFilled, Fire, Information, Launch, VisualRecognition, Rocket, WarningAlt } from "@carbon/react/icons";
import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";

type TradeVolumeOption = "0" | "1" | "5" | "10";
type TradeTimeOption = "6h" | "12h" | "24h";
type TradesSortOption = "volume" | "time";

export default function MarketPage() {
  const { fmt, tr } = useLocalization();
  const [tradeVolume, setTradeVolume] = useState<TradeVolumeOption>("1");
  const [tradeTime, setTradeTime] = useState<TradeTimeOption>("24h");
  const [tradesSort, setTradesSort] = useState<TradesSortOption>("volume");
  const [activeTab, setActiveTab] = useState<"all" | "watchlist" | "trades">("all");
  const [isTreeMapOpen, setIsTreeMapOpen] = useState(false);
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
  
  const fullCurrencyFormatter = (val: number | null) =>
    val != null
      ? new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(val)
      : "-";

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
  const topLosers = useGet(client.api.traders.losers, 200);

  const tradersLoading = topTraders.isLoading || topLosers.isLoading;

  const recentTradesData = useGet(client.api.trades.recent, 200, {
    query: {
      timeWindow: tradeTime,
      usdThreshold: Number(tradeVolume),
      sortBy: tradesSort,
    },
  });

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
        link: `/tokens/${token.address}`,
      };
    });

    return data;
  }, [topTokens.data, meta.data, marketData.data, fmt]);

  const compactPercent = (val: number | null | undefined) => {
    if (val == null) return "-";
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 4 }).format(val) + "%";
  };

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
        favorite: (
          <button
            type="button"
            aria-label={watchlist.includes(token.address) ? tr("marketPage.removeFromWatchlist") : tr("marketPage.addToWatchlist")}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWatchlist(token.address);
            }}
            className={styles.starButton}
            style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", padding: "8px", borderRadius: "4px" }}
          >
            {watchlist.includes(token.address) ? (
              <StarFilled size={18} className={styles.activeStarIcon} style={{ color: "var(--cds-support-warning, #f1c21b)" }} />
            ) : (
              <Star size={18} style={{ color: "var(--cds-icon-secondary, #525252)" }} />
            )}
          </button>
        ),
        token: (
          <Link
            href={`/tokens/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Stack
              orientation="horizontal"
              gap={2}
              style={{ alignItems: "center", overflow: "hidden", width: "100%" }}
            >
              {tokenMeta.imageUrl && (
                <img
                  src={tokenMeta.imageUrl}
                  alt={tokenMeta.symbol}
                  width={28}
                  style={{ borderRadius: "50%", flexShrink: 0 }}
                />
              )}

              <span style={{ display: "flex", alignItems: "baseline", gap: "6px", overflow: "hidden", minWidth: 0 }}>
                <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {tokenMeta.name}
                </strong>
                <span style={{ fontSize: "12px", color: "var(--cds-text-secondary, #8d8d8d)", flexShrink: 0 }}>
                  {tokenMeta.symbol.toUpperCase()}
                </span>
              </span>
            </Stack>
          </Link>
        ),
        price: fmt.num.currency(tokenMarket.priceUsd),
        change1h: (
          <TrendNum
            value={tokenMarket.priceChangePercentage1h}
            formatter={compactPercent}
          />
        ),
        change24h: (
          <TrendNum
            value={tokenMarket.priceChangePercentage24h}
            formatter={compactPercent}
          />
        ),
        change7d: (
          <TrendNum
            value={tokenMarket.priceChangePercentage7d}
            formatter={compactPercent}
          />
        ),
        volume24h: fullCurrencyFormatter(tokenMarket.volume24h),
        marketCap: fullCurrencyFormatter(tokenMarket.marketCap),
        fdv: fullCurrencyFormatter(tokenMarket.fullyDilutedValuation),
        sparkline: (
          <div style={{ width: "100%", height: 40, paddingLeft: 24 }}>
            <SparklineChart 
              data={tokenMarket.sparkline7d ?? []} 
              positive={
                tokenMarket.priceChangePercentage7d != null
                  ? tokenMarket.priceChangePercentage7d >= 0
                  : undefined
              } 
            />
          </div>
        ),
      };
    });
  }, [topTokens.data, meta.data, marketData.data, fmt, watchlist, tr]);

  const traderRows = useMemo(() => {
    if (!topTraders.data) return [];

    return topTraders.data.map((t) => ({
      id: t.address,
      trader: (
        <Tooltip label={t.address} align="bottom-left">
          <Link href={`/wallet/${t.address}`}>
            {fmt.text.address(t.address)}
          </Link>
        </Tooltip>
      ),
      pnl: (
        <span className={t.pnl > 0 ? semStyle.positive : t.pnl < 0 ? semStyle.negative : undefined}>
          {fmt.num.currency(t.pnl)}
        </span>
      ),
      volume: fmt.num.compact.currency(t.volume),
      trades: t.tradeCount,
    }));
  }, [topTraders.data, fmt]);

  const loserRows = useMemo(() => {
    if (!topLosers.data) return [];

    const truncate = (a: string) =>
      a ? `${a.slice(0, 6)}...${a.slice(-4)}` : a;

    return topLosers.data.map((t) => ({
      id: t.address,
      trader: (
        <Tooltip label={t.address} align="bottom-left">
          <Link href={`/wallet/${t.address}`}>{truncate(t.address)}</Link>
        </Tooltip>
      ),
      pnl: (
        <span className={t.pnl > 0 ? semStyle.positive : t.pnl < 0 ? semStyle.negative : undefined}>
          {fmt.num.currency(t.pnl)}
        </span>
      ),
      volume: fmt.num.compact.currency(t.volume),
      trades: t.tradeCount,
    }));
  }, [topLosers.data, fmt]);

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
          <Link
            href={`/tokens/${token.address}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Stack
              orientation="horizontal"
              gap={2}
              style={{ alignItems: "center", overflow: "hidden", width: "100%" }}
            >
              {tokenMeta.imageUrl && (
                <img
                  src={tokenMeta.imageUrl}
                  alt={tokenMeta.symbol}
                  width={28}
                  style={{ borderRadius: "50%", flexShrink: 0 }}
                />
              )}

              <span style={{ display: "flex", alignItems: "baseline", gap: "6px", overflow: "hidden", minWidth: 0 }}>
                <Tooltip label={tokenMeta.name} align="right">
                  <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tokenMeta.symbol.toUpperCase()}
                  </strong>
                </Tooltip>
              </span>
            </Stack>
          </Link>
        ),
        price: fmt.num.currency(tokenMarket.priceUsd),
        change24h: (
          <TrendNum
            value={tokenMarket.priceChange24h}
            formatter={compactPercent}
          />
        ),
        marketCap: fullCurrencyFormatter(tokenMarket.marketCap),
        volume24h: fullCurrencyFormatter(tokenMarket.volume24h),
      };
    });
  }, [trendingTokens.data, trendingMeta.data, trendingMarketData.data, fmt]);

  const recentTradesRows = useMemo(() => {
    if (!recentTradesData.data) return [];

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
        <Stack gap={1}>
          <span>
            {Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(trade.baseAmount || 0))} {trade.baseSymbol}
          </span>
          <span style={{ color: 'var(--cds-text-secondary, #525252)' }}>
            {Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(Number(trade.quoteAmount || 0))} {trade.quoteSymbol}
          </span>
        </Stack>
      ),
      volume: fmt.num.compact.currency(trade.volumeUsd),
      trader: (
        <Tooltip label={trade.owner} align="bottom-left">
          <Link href={`/wallet/${trade.owner}`}>
            {fmt.text.address(trade.owner)}
          </Link>
        </Tooltip>
      ),
      time: fmt.datetime.relative(trade.blockUnixTime * 1000.0),
    }));
  }, [recentTradesData.data, fmt]);

  const tickerItems = useMemo(() => {
    if (
      !trendingTokens.data ||
      !trendingMeta.data ||
      !trendingMarketData.data
    )
      return [];

    const addressToMeta = Object.fromEntries(
      trendingMeta.data.map((m) => [m.address, m]),
    );
    const addressToMarket = trendingMarketData.data;

    return trendingTokens.data.map((token) => {
      const tokenMeta = addressToMeta[token.address];
      const tokenMarket = addressToMarket[token.address];

      return {
        address: token.address,
        rank: token.rank,
        symbol: tokenMeta?.symbol || "",
        imageUrl: tokenMeta?.imageUrl ?? undefined,
        priceUsd: tokenMarket?.priceUsd || 0,
        priceChange24h: tokenMarket?.priceChange24h || 0,
      };
    });
  }, [trendingTokens.data, trendingMeta.data, trendingMarketData.data]);

  return (
    <PageWrapper>
      <section className={styles.marketPage}>
        <MarketTicker 
          label="Trending" 
          icon={<Fire size={16} fill="var(--cds-support-error, #da1e28)" />} 
          items={tickerItems} 
          formatter={{
            currency: fmt.num.currency,
            percent: fmt.num.percent,
          }}
        />
        <div className={styles.content}>
          <Grid
            className={`${overwriteStyles.wdGrd} ${styles.marketGrid}`}
          >
            <Column sm={2} md={8} lg={16} className={styles.marketColumn}>
              <div className={styles.headerSection}>
                <h1 className={styles.title}>
                  {activeTab === "all"
                    ? "Cryptocurrency Prices by Market Cap"
                    : activeTab === "watchlist"
                    ? "Your Watchlist"
                    : "Market Activity & Highlights"}
                </h1>
                <p className={styles.subtitle}>
                  {activeTab === "all"
                    ? "The global cryptocurrency market continues to evolve with significant activity across key assets. Below is an overview of the top tokens by market capitalization and their recent performance."
                    : activeTab === "watchlist"
                    ? "Track your favorite tokens and monitor their performance in one place."
                    : "Discover top performing traders and the latest significant swaps across decentralized exchanges."}
                </p>
              </div>
              <div className={styles.tabsContainer}>
                <div className={styles.tabs}>
                  <button
                    className={clsx(styles.tab, activeTab === "all" && styles.active)}
                    onClick={() => setActiveTab("all")}
                  >
                    All
                  </button>
                  <button
                    className={clsx(styles.tab, activeTab === "watchlist" && styles.active)}
                    onClick={() => setActiveTab("watchlist")}
                  >
                    Watchlist
                  </button>
                  <button
                    className={clsx(styles.tab, activeTab === "trades" && styles.active)}
                    onClick={() => setActiveTab("trades")}
                  >
                    Trades
                  </button>
                </div>

                <div className={styles.tabActions}>
                  {activeTab === "all" && (
                    <button 
                      className={styles.treeMapButton}
                      onClick={() => setIsTreeMapOpen(true)}
                    >
                      {tr("marketPage.marketMap")}
                    </button>
                  )}
                </div>
              </div>

              <div className={clsx(styles.panel, activeTab === "trades" && styles.panelTrades)}>
                {activeTab === "trades" ? (
                  <Stack gap={6}>
                    <div className={styles.tradersGrid}>
                      {/* Top Gainers */}
                      <div className={styles.boxedTableContainer}>
                        <div className={styles.boxedTableHeader}>
                          <div className={styles.headerLeft}>
                            <span className={styles.title}>{tr("marketPage.topGainers")}</span>
                            <p className={styles.description}>{tr("marketPage.topGainersDesc")}</p>
                          </div>
                        </div>
                        <Tble
                          height="auto"
                          loading={tradersLoading}
                          headers={[
                            { key: "trader", header: tr("marketPage.trader"), align: "start" },
                            { key: "pnl", header: tr("marketPage.profits"), align: "end" },
                            { key: "volume", header: tr("marketPage.volume"), align: "end" },
                            { key: "trades", header: tr("marketPage.trades"), align: "end" },
                          ]}
                          rows={traderRows.slice(0, 10)}
                        />
                      </div>

                      {/* Top Losers */}
                      <div className={styles.boxedTableContainer}>
                        <div className={styles.boxedTableHeader}>
                          <div className={styles.headerLeft}>
                            <span className={styles.title}>{tr("marketPage.topLosers")}</span>
                            <p className={styles.description}>{tr("marketPage.topLosersDesc")}</p>
                          </div>
                        </div>
                        <Tble
                          height="auto"
                          loading={tradersLoading}
                          headers={[
                            { key: "trader", header: tr("marketPage.trader"), align: "start" },
                            { key: "pnl", header: tr("marketPage.profits"), align: "end" },
                            { key: "volume", header: tr("marketPage.volume"), align: "end" },
                            { key: "trades", header: tr("marketPage.trades"), align: "end" },
                          ]}
                          rows={loserRows.slice(0, 10)}
                        />
                      </div>
                    </div>

                    {/* Recent Trades */}
                    <div className={styles.boxedTableContainer}>
                      <div className={styles.boxedTableHeader}>
                        <div className={styles.headerLeft}>
                          <span className={styles.title}>{tr("marketPage.recentTrades")}</span>
                          <p className={styles.description}>{tr("marketPage.recentTradesDesc")}</p>
                        </div>
                        <div className={styles.filterContainer}>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>{tr("marketPage.volume")}</span>
                            <FilterSwitch
                              options={[
                                { value: "0", label: "All" },
                                { value: "1", label: ">$1" },
                                { value: "5", label: ">$5" },
                                { value: "10", label: ">$10" },
                              ]}
                              value={tradeVolume}
                              onChange={(v) => setTradeVolume(v as TradeVolumeOption)}
                              tooltipLabel="Volume"
                            />
                          </div>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>{tr("marketPage.time")}</span>
                            <FilterSwitch
                              options={[
                                { value: "6h", label: "6h" },
                                { value: "12h", label: "12h" },
                                { value: "24h", label: "24h" },
                              ]}
                              value={tradeTime}
                              onChange={(v) => setTradeTime(v as TradeTimeOption)}
                              tooltipLabel="Time"
                            />
                          </div>
                          <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>{tr("marketPage.sortBy")}</span>
                            <FilterSwitch
                              options={[
                                { value: "volume", label: "Volume" }, // or use translation if needed
                                { value: "time", label: "Time" },
                              ]}
                              value={tradesSort}
                              onChange={(v) => setTradesSort(v as TradesSortOption)}
                              tooltipLabel="Sort By"
                            />
                          </div>
                        </div>
                      </div>
                      <Tble
                        height="auto"
                        loading={recentTradesData.isLoading}
                        headers={[
                          { key: "time", header: tr("marketPage.time"), width: "15%", align: "start" },
                          { key: "volume", header: tr("marketPage.value"), width: "25%", align: "end" },
                          { key: "amount", header: tr("marketPage.amount"), width: "25%", align: "end" },
                          { key: "trader", header: tr("marketPage.trader"), width: "25%", align: "end" },
                          { key: "solscan", header: tr("marketPage.transaction"), width: "10%", align: "end" },
                        ]}
                        rows={recentTradesRows.slice(0, 20)}
                      />
                    </div>
                  </Stack>
                ) : activeTab === "watchlist" && watchlist.length === 0 ? (
                  <div className={styles.placeholderTab}>
                    <h3>{tr("marketPage.watchlistEmptyTitle")}</h3>
                    <p>{tr("marketPage.watchlistEmptySubtitle")}</p>
                  </div>
                ) : (
                  <Tble
                    height="auto"
                    loading={loading}
                    headers={[
                      { key: "favorite", header: "", width: "56px", align: "center" },
                      { key: "token", header: tr("marketPage.token"), width: "18%", align: "start" },
                      { key: "price", header: tr("marketPage.price"), width: "8%", align: "end" },
                      { key: "change1h", header: "1h", width: "8%", align: "end" },
                      { key: "change24h", header: "24h", width: "8%", align: "end" },
                      { key: "change7d", header: "7d", width: "8%", align: "end" },
                      { key: "volume24h", header: tr("marketPage.volume24h"), width: "11%", align: "end" },
                      { key: "marketCap", header: tr("marketPage.marketCap"), width: "12%", align: "end" },
                      { key: "fdv", header: "FDV", width: "11%", align: "end" },
                      { key: "sparkline", header: "Last 7 Days", width: "16%", align: "end" },
                    ]}
                    rows={activeTab === "watchlist" 
                      ? topTokenRows.filter(row => watchlist.includes(row.id)) 
                      : topTokenRows}
                  />
                )}
              </div>
            </Column>

            <Modal
              open={isTreeMapOpen}
              onRequestClose={() => setIsTreeMapOpen(false)}
              modalHeading={tr("marketPage.marketMap")}
              passiveModal
              size="lg"
              className={styles.treeMapModal}
            >
              <div className={styles.heatmapBody}>
                <TokenTreeMap
                  loading={loading}
                  data={treeMapData}
                  height={600}
                  maxTrendValue={20}
                />
              </div>
            </Modal>


          </Grid>
        </div>
      </section>
    </PageWrapper>
  );
}
