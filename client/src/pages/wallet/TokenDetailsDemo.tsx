import client from "@/api/main";
import { SOLSCAN_TX_URL } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { useGet } from "@/hooks/useGet";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { BarChart3, Copy, ExternalLink, LineChart, TrendingDown, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import styles from "./TokenDetailsDemo.module.scss";

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
type TradeSide = "buy" | "sell";
type PricePoint = { unixTimeMs: number; value: number };
type RawTrade = {
  tradeAction: TradeSide;
  blockUnixTimeMs: number;
  volumeUsd: number;
  transactionHash: string;
  baseAmount: number;
  quoteAmount: number;
  basePrice?: number;
  priceUsd?: number;
  tradePriceUsd?: number;
  baseQuotePrice?: number;
};

type WalletTokenDetail = {
  tokenAddress: string;
  balanceAmount: number;
  unrealizedProfitUsd: number;
  realizedProfitUsd: number;
  realizedProfitPercent: number;
  unrealizedProfitPercent: number;
  totalBoughtUsd: number;
  totalBoughtAmount: number;
  totalSoldUsd: number;
  totalSoldAmount: number;
  totalBuyCount: number;
  totalSellCount: number;
  avgBuyCost: number;
  avgSellCost: number;
  lastTradeUnixTime: number;
};

type TokenMeta = { address: string; imageUrl?: string | null; symbol?: string | null; name?: string | null };
type TokenMarket = { address: string; priceUsd?: number | null };

const DAY_MS = 24 * 60 * 60 * 1000;

function getTradePrice(trade: RawTrade): number | null {
  const candidates = [trade.basePrice, trade.priceUsd, trade.tradePriceUsd, trade.baseQuotePrice];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export function isTradeWithinSelectedRange(
  tradeUnixTimeMs: unknown,
  selectedTimeRange: TokenPriceDayRange,
  nowMs = Date.now(),
): boolean {
  return typeof tradeUnixTimeMs === "number" && Number.isFinite(tradeUnixTimeMs)
    && tradeUnixTimeMs >= nowMs - selectedTimeRange * DAY_MS
    && tradeUnixTimeMs <= nowMs;
}

export function filterTradesWithinSelectedRange<T extends { unixTimeMs: number }>(
  trades: T[],
  selectedTimeRange: TokenPriceDayRange,
  nowMs = Date.now(),
): T[] {
  return trades.filter((trade) => isTradeWithinSelectedRange(trade.unixTimeMs, selectedTimeRange, nowMs));
}

function AddressCopyButton({ value }: { value: string }) {
  const { tr } = useLocalization();
  return <button type="button" className={styles.copyButton} onClick={() => void navigator.clipboard.writeText(value)} title={String(tr("walletPage.ui.copyAddress"))} aria-label={String(tr("walletPage.ui.copyAddress"))}><Copy size={14} strokeWidth={1.8} /></button>;
}

export function TokenAverageTradePrice({
  walletAddress,
  tokenAddress,
  tokenImgUrl,
  tokenSymbol,
  tokenName,
  tokenCurrentPrice,
  avgBuyPrice,
  avgSellPrice,
}: TokenAverageTradePriceProps) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const [range, setRange] = useState<TokenPriceDayRange>(7);

  const priceResponse = useGet(
    client.api.tokens.markets.chart[":address"].daily,
    200,
    { param: { address: tokenAddress }, query: { days: String(range) } },
    { select: (data) => (data as unknown as Array<{ unixTimestampMs: number; price: number }>).map((item) => ({ unixTimeMs: item.unixTimestampMs, value: item.price })) },
  );
  const tradesResponse = useGet(
    client.api.wallets[":walletAddress"].trades[":tokenAddress"],
    200,
    { param: { walletAddress, tokenAddress } },
  );

  const trades = useMemo(() => {
    const source = (tradesResponse.data as unknown as RawTrade[] | undefined) ?? [];
    return filterTradesWithinSelectedRange(source.map((trade) => ({ ...trade, unixTimeMs: trade.blockUnixTimeMs, price: getTradePrice(trade) })).filter((trade) => Number.isFinite(trade.unixTimeMs)), range);
  }, [range, tradesResponse.data]);
  const prices = (priceResponse.data ?? []) as PricePoint[];

  const option = useMemo<EChartsOption>(() => {
    const text = isDark ? "#e7ecf5" : "#172033";
    const muted = isDark ? "#9aa8bd" : "#67748a";
    const grid = isDark ? "rgba(128, 151, 184, 0.16)" : "#e8edf4";
    const tooltipBg = isDark ? "#151e2c" : "#ffffff";
    const buy = isDark ? "#4ed3a8" : "#118563";
    const sell = isDark ? "#ff848d" : "#c9434d";
    const line = isDark ? "#aab5ff" : "#4458d9";
    return {
      animationDuration: 350,
      backgroundColor: "transparent",
      grid: { top: 24, right: 18, bottom: 30, left: 12, containLabel: true },
      tooltip: { trigger: "axis", backgroundColor: tooltipBg, borderColor: isDark ? "#34445d" : "#dbe3ee", borderWidth: 1, textStyle: { color: text, fontSize: 12 }, valueFormatter: (value) => fmt.num.compact.currency(Number(value)) },
      xAxis: { type: "time", axisLine: { lineStyle: { color: grid } }, axisTick: { show: false }, axisLabel: { color: muted, fontSize: 10 }, splitLine: { show: false } },
      yAxis: { type: "value", position: "right", axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: muted, fontSize: 10, formatter: (value: number) => fmt.num.compact.currency(value) }, splitLine: { lineStyle: { color: grid, type: "dashed" } } },
      series: [
        { type: "line", name: tokenSymbol ?? tr("walletPage.token"), data: prices.map((point) => [point.unixTimeMs, point.value]), smooth: 0.15, showSymbol: false, lineStyle: { width: 2.1, color: line }, itemStyle: { color: line }, markLine: { silent: true, symbol: "none", label: { color: muted, fontSize: 10 }, data: [{ yAxis: avgBuyPrice, name: tr("walletPage.avgBuyPrice"), lineStyle: { color: buy, type: "dashed" } }, { yAxis: avgSellPrice, name: tr("walletPage.avgSellPrice"), lineStyle: { color: sell, type: "dashed" } }] } },
        { type: "scatter", name: tr("walletPage.buy"), data: trades.filter((trade) => trade.tradeAction === "buy" && trade.price != null).map((trade) => [trade.unixTimeMs, trade.price]), symbolSize: 8, itemStyle: { color: buy } },
        { type: "scatter", name: tr("walletPage.sell"), data: trades.filter((trade) => trade.tradeAction === "sell" && trade.price != null).map((trade) => [trade.unixTimeMs, trade.price]), symbolSize: 8, itemStyle: { color: sell } },
      ],
    };
  }, [avgBuyPrice, avgSellPrice, fmt, isDark, prices, tokenSymbol, tr, trades]);

  return (
    <section className={styles.detailPanel}>
      <header className={styles.detailHeader}>
        <div className={styles.tokenTitle}>
          {tokenImgUrl ? <img src={tokenImgUrl} alt="" /> : <span className={styles.tokenFallback}>{(tokenSymbol ?? "T").slice(0, 1)}</span>}
          <div><span className={styles.detailEyebrow}>{tr("walletPage.averageTradingPrice")}</span><strong>{tokenSymbol?.toUpperCase() ?? fmt.text.address(tokenAddress)} <AddressCopyButton value={tokenAddress} /></strong><small>{tokenName ?? tokenAddress}</small></div>
        </div>
        <div className={styles.currentPrice}><span>{tr("walletPage.price")}</span><strong>{tokenCurrentPrice != null ? fmt.num.currency(tokenCurrentPrice) : "—"}</strong></div>
        <div className={styles.rangeButtons}>{([7, 30, 90] as const).map((item) => <button key={item} type="button" data-active={range === item} onClick={() => setRange(item)}>{item}d</button>)}</div>
      </header>
      <div className={styles.tokenChart}>{priceResponse.isLoading ? <div className={styles.centered}>{tr("common.loading")}</div> : <ReactECharts option={option} notMerge lazyUpdate style={{ height: 290, width: "100%" }} />}</div>
      <div className={styles.tradeSubhead}><span>{tr("walletPage.recentTrades")}</span><small>{tr("walletPage.recentTradesDescription")}</small></div>
      <div className={styles.tradeTableWrap}>
        <table className={styles.tradeTable}><thead><tr><th>{tr("walletPage.time")}</th><th>{tr("walletPage.action")}</th><th>{tr("walletPage.amount")}</th><th>{tr("walletPage.value")}</th><th aria-label={tr("walletPage.openInSolscan")} /></tr></thead>
        <tbody>{tradesResponse.isLoading ? <tr><td colSpan={5} className={styles.centered}>{tr("common.loading")}</td></tr> : trades.slice(0, 8).map((trade) => { const isBuy = trade.tradeAction === "buy"; const amount = isBuy ? trade.baseAmount : trade.quoteAmount; return <tr key={trade.transactionHash}><td>{fmt.datetime.relativeShort(trade.blockUnixTimeMs, true)}</td><td><span className={styles.side} data-side={trade.tradeAction}>{isBuy ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{isBuy ? tr("walletPage.buy") : tr("walletPage.sell")}</span></td><td>{fmt.num.compact.unit(amount, tokenSymbol?.toUpperCase() ?? null)}</td><td>{fmt.num.compact.currency(trade.volumeUsd)}</td><td><a href={`${SOLSCAN_TX_URL}/${trade.transactionHash}`} target="_blank" rel="noreferrer" className={styles.externalLink}><ExternalLink size={14} strokeWidth={1.8} /></a></td></tr>; })}</tbody></table>
      </div>
    </section>
  );
}

export function TokenDetailsDemo({ setSelectedToken }: { setSelectedToken: React.Dispatch<React.SetStateAction<{ address: string; symbol: string; avgBuyCost: number; avgSellCost: number } | null>>; }) {
  const { address } = useParams<{ address: string }>();
  const { tr, fmt } = useLocalization();
  const walletTokenDetails = useGet(client.api.wallets[":address"].tokens, 200, { param: { address: address || "" } }, { enabled: Boolean(address) });
  const tokenAddresses = useMemo(() => ((walletTokenDetails.data as unknown as WalletTokenDetail[] | undefined)?.map((item) => item.tokenAddress).join(",") || null), [walletTokenDetails.data]);
  const tokenMeta = useGet(client.api.tokens.meta[":addresses"], 200, { param: { addresses: tokenAddresses || "" } }, { enabled: Boolean(tokenAddresses), select: (data) => Object.fromEntries((data as unknown as TokenMeta[]).map((item) => [item.address, item])) });
  const tokenMarket = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    {
      enabled: Boolean(tokenAddresses),
      select: (data) => Array.isArray(data)
        ? Object.fromEntries((data as unknown as TokenMarket[]).map((item) => [item.address, item]))
        : (data as unknown as Record<string, TokenMarket>),
    },
  );
  const rows = ((walletTokenDetails.data as unknown as WalletTokenDetail[] | undefined) ?? []).slice(0, 20);
  const metaMap = (tokenMeta.data ?? {}) as Record<string, TokenMeta>;
  const marketMap = (tokenMarket.data ?? {}) as Record<string, TokenMarket>;

  if (!address) return null;

  return (
    <section className={styles.tokenListPanel} aria-label={tr("walletPage.tokensLastTraded")}>
      <header className={styles.listHeader}>
        <div><span className={styles.detailEyebrow}>{tr("walletPage.activity")}</span><h2>{tr("walletPage.tokensLastTraded")}</h2><p>{tr("walletPage.tokensLastTradedDescription")}</p></div>
        <span className={styles.tokenCount}>{rows.length}</span>
      </header>
      <div className={styles.tokenListWrap}>
        <table className={styles.tokenListTable}><thead><tr><th>{tr("walletPage.token")}</th><th>{tr("walletPage.balance")}</th><th>{tr("walletPage.profit")}</th><th>{tr("walletPage.realizedProfit")}</th><th>{tr("walletPage.unrealizedProfit")}</th><th>{tr("walletPage.averageTradingPrice")}</th></tr></thead>
          <tbody>{walletTokenDetails.isLoading ? <tr><td colSpan={6} className={styles.centered}>{tr("common.loading")}</td></tr> : rows.length === 0 ? <tr><td colSpan={6} className={styles.centered}>{tr("common.noData")}</td></tr> : rows.map((details) => { const meta = metaMap[details.tokenAddress]; const market = marketMap[details.tokenAddress]; const symbol = meta?.symbol?.toUpperCase() ?? fmt.text.address(details.tokenAddress); const totalPnl = details.unrealizedProfitUsd + details.realizedProfitUsd; const isPositive = totalPnl >= 0; return <tr key={details.tokenAddress}><td><button type="button" className={styles.tokenCell} onClick={() => setSelectedToken({ address: details.tokenAddress, symbol, avgBuyCost: details.avgBuyCost, avgSellCost: details.avgSellCost })}>{meta?.imageUrl ? <img src={meta.imageUrl} alt="" /> : <span className={styles.tokenFallback}>{symbol.slice(0, 1)}</span>}<span><strong>{symbol}</strong><small>{fmt.datetime.relativeShort(details.lastTradeUnixTime * 1000, true)}</small></span></button></td><td><strong>{fmt.num.compact.currency((market?.priceUsd ?? 0) * details.balanceAmount)}</strong><small>{fmt.num.compact.decimal(details.balanceAmount)}</small></td><td><span className={styles.pnl} data-positive={isPositive}>{fmt.num.compact.currency(totalPnl)}</span><small>{fmt.num.percent(details.realizedProfitPercent + details.unrealizedProfitPercent)}</small></td><td><span className={styles.pnl} data-positive={details.realizedProfitUsd >= 0}>{fmt.num.compact.currency(details.realizedProfitUsd)}</span></td><td><span className={styles.pnl} data-positive={details.unrealizedProfitUsd >= 0}>{fmt.num.compact.currency(details.unrealizedProfitUsd)}</span></td><td><button type="button" className={styles.chartButton} onClick={() => setSelectedToken({ address: details.tokenAddress, symbol, avgBuyCost: details.avgBuyCost, avgSellCost: details.avgSellCost })}><LineChart size={15} strokeWidth={1.85} />{tr("walletPage.graph")}</button></td></tr>; })}</tbody>
        </table>
      </div>
    </section>
  );
}
