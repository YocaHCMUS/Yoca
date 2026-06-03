import { createHash } from "node:crypto";

import { getRssTokenNews, type TokenNewsArticle } from "@sv/services/rss-news.service.js";
import {
  get24hTokenMarketChart,
  getDailyTokenMarketChart,
  getHourlyTokenMarketChart,
  getPoolTrades24h,
  getTokenDetails,
  getTokenHolderStats,
  getTokenMarketData,
  getTokenMeta,
  getTokenTopPools,
  getTopTokenHolders,
} from "@sv/services/tokens/index.js";
import {
  getTokenPriceVolatilityEvents,
  type TokenPriceVolatilityEvent,
} from "@sv/services/tokens/token-volatility.js";

export type TokenAiTimeframe = "24h" | "7d" | "1m" | "3m" | "1y";
export type TokenAiLanguage = "en" | "vi";
export type TokenAiIntent =
  | "price_move_explanation"
  | "latest_news"
  | "risk_overview"
  | "bullish_bearish"
  | "simple_explanation"
  | "what_to_watch"
  | "investment_guidance"
  | "custom";

export type TokenAiEvidenceType =
  | "market"
  | "chart"
  | "news"
  | "volatility"
  | "holders"
  | "pool"
  | "trades"
  | "metadata"
  | "internal";

export interface TokenAiEvidence {
  type: TokenAiEvidenceType;
  label: string;
  value?: string;
  detail?: string;
  url?: string;
  timestamp?: string;
  source?: string;
}

export interface TokenAiSource {
  title: string;
  publisher?: string;
  url: string;
  publishedAt?: string | null;
  snippet?: string;
  sourceType?: "internal" | "external";
}

export interface TokenAiMissingSection {
  section: string;
  available: false;
  reason: string;
}

export interface TokenAiContext {
  token: {
    address: string;
    symbol?: string;
    name?: string;
    yocaUrl: string;
  };
  timeframe: TokenAiTimeframe;
  market: unknown | null;
  metadata: unknown | null;
  chartSummary: {
    points: number;
    firstPrice: number | null;
    lastPrice: number | null;
    changePercent: number | null;
    from?: string;
    to?: string;
  } | null;
  latestNews: TokenNewsArticle[];
  chartNewsMarkers: Array<{
    date: string;
    timestamp: string;
    articleCount: number;
    topTitles: string[];
  }>;
  volatilityEvents: TokenPriceVolatilityEvent[];
  holderStats: unknown | null;
  topHolders: unknown[];
  pools: unknown[];
  recentTrades: unknown[];
  evidence: TokenAiEvidence[];
  sources: TokenAiSource[];
  missingSections: TokenAiMissingSection[];
  builtAt: string;
}

export interface BuildTokenAiContextInput {
  address: string;
  symbol?: string;
  name?: string;
  timeframe: TokenAiTimeframe;
  includeNews: boolean;
  includeVolatility: boolean;
}

const timeframeDays: Record<TokenAiTimeframe, number> = {
  "24h": 1,
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
};

function compactCurrency(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(number) >= 1 ? 2 : 8,
  }).format(number);
}

function compactNumber(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;

  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(number) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(number);
}

function percent(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return `${number > 0 ? "+" : ""}${number.toFixed(2)}%`;
}

function toDate(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
  }
  return undefined;
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function articleTimestamp(article: TokenNewsArticle) {
  if (!article.publishedAt) return 0;
  const timestamp = Date.parse(article.publishedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function dedupeArticles(articles: TokenNewsArticle[]) {
  const byUrl = new Map<string, TokenNewsArticle>();
  for (const article of articles) {
    const key = article.url.trim().toLowerCase().replace(/\/$/, "");
    const existing = byUrl.get(key);
    if (!existing || article.score > existing.score) byUrl.set(key, article);
  }

  const byTitle = new Map<string, TokenNewsArticle>();
  for (const article of byUrl.values()) {
    const key = normalizeTitle(article.title);
    const existing = byTitle.get(key);
    if (!existing || article.score > existing.score) byTitle.set(key, article);
  }

  return [...byTitle.values()].sort(
    (a, b) => articleTimestamp(b) - articleTimestamp(a),
  );
}

function groupArticlesByDate(
  articles: TokenNewsArticle[],
  timeframe: TokenAiTimeframe,
) {
  const cutoffMs = Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000;
  const groups = new Map<string, TokenNewsArticle[]>();

  for (const article of articles) {
    const timestamp = articleTimestamp(article);
    if (timestamp <= 0 || timestamp < cutoffMs) continue;
    const date = new Date(timestamp).toISOString().slice(0, 10);
    const group = groups.get(date) ?? [];
    group.push(article);
    groups.set(date, group);
  }

  return [...groups.entries()]
    .map(([date, grouped]) => ({
      date,
      timestamp: `${date}T00:00:00.000Z`,
      articleCount: grouped.length,
      topTitles: grouped
        .sort((a, b) => articleTimestamp(b) - articleTimestamp(a))
        .slice(0, 3)
        .map((article) => article.title),
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, 5);
}

function getChartDays(timeframe: TokenAiTimeframe) {
  return timeframeDays[timeframe];
}

async function readChartSummary(address: string, timeframe: TokenAiTimeframe) {
  const days = getChartDays(timeframe);
  const rows =
    timeframe === "24h"
      ? await get24hTokenMarketChart(address)
      : days <= 90
        ? await getHourlyTokenMarketChart(address, days)
        : await getDailyTokenMarketChart(address, days);

  const points = rows
    .map((row) => ({
      timestampMs: Number(row.unixTimestampMs),
      price: Number(row.price),
    }))
    .filter(
      (point) =>
        Number.isFinite(point.timestampMs) &&
        Number.isFinite(point.price) &&
        point.price > 0,
    )
    .sort((a, b) => a.timestampMs - b.timestampMs);

  if (points.length < 2) {
    return {
      summary: {
        points: points.length,
        firstPrice: points[0]?.price ?? null,
        lastPrice: points[0]?.price ?? null,
        changePercent: null,
        from: points[0] ? new Date(points[0].timestampMs).toISOString() : undefined,
        to: points[0] ? new Date(points[0].timestampMs).toISOString() : undefined,
      },
      evidence: null,
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const changePercent = ((last.price - first.price) / first.price) * 100;

  return {
    summary: {
      points: points.length,
      firstPrice: first.price,
      lastPrice: last.price,
      changePercent,
      from: new Date(first.timestampMs).toISOString(),
      to: new Date(last.timestampMs).toISOString(),
    },
    evidence: {
      type: "chart" as const,
      label: `${timeframe} chart change`,
      value: percent(changePercent),
      detail: `${points.length} price points from ${new Date(first.timestampMs).toISOString()} to ${new Date(last.timestampMs).toISOString()}.`,
      timestamp: new Date(last.timestampMs).toISOString(),
      source: "Yoca chart cache/provider",
    },
  };
}

async function safe<T>(section: string, fn: () => Promise<T>) {
  try {
    return { ok: true as const, value: await fn() };
  } catch (err) {
    return {
      ok: false as const,
      missing: {
        section,
        available: false as const,
        reason: err instanceof Error ? err.message : "Section unavailable.",
      },
    };
  }
}

export function hashTokenAiContext(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

export async function buildTokenAiContext(
  input: BuildTokenAiContextInput,
): Promise<TokenAiContext> {
  const address = input.address.trim();
  const missingSections: TokenAiMissingSection[] = [
    {
      section: "security",
      available: false,
      reason:
        "Mint authority, freeze authority, deployer, creator, honeypot status, and security flags are not available in the current backend.",
    },
  ];

  const [detailsRes, metaRes, marketRes, chartRes, holdersRes, holderStatsRes] =
    await Promise.all([
      safe("metadata", () => getTokenDetails([address])),
      safe("metadata_fallback", () => getTokenMeta([address])),
      safe("market", () => getTokenMarketData([address])),
      safe("chart", () => readChartSummary(address, input.timeframe)),
      safe("holders", () => getTopTokenHolders(address)),
      safe("holder_stats", () => getTokenHolderStats([address])),
    ]);

  const detailsRow =
    detailsRes.ok && detailsRes.value.length > 0 ? detailsRes.value[0] : null;
  const metaRow =
    detailsRow?.meta ??
    (metaRes.ok && metaRes.value.length > 0 ? metaRes.value[0] : null);
  const market =
    marketRes.ok && marketRes.value ? marketRes.value[address] ?? null : null;
  const holderStats =
    holderStatsRes.ok && holderStatsRes.value.length > 0
      ? holderStatsRes.value[0]
      : null;
  const topHolders = holdersRes.ok ? holdersRes.value.slice(0, 10) : [];
  const chartSummary = chartRes.ok ? chartRes.value.summary : null;

  const token = {
    address,
    symbol: input.symbol?.trim() || metaRow?.symbol || undefined,
    name: input.name?.trim() || metaRow?.name || undefined,
    yocaUrl: `/tokens/${address}`,
  };

  for (const res of [
    detailsRes,
    metaRes,
    marketRes,
    chartRes,
    holdersRes,
    holderStatsRes,
  ]) {
    if (!res.ok) missingSections.push(res.missing);
  }

  const evidence: TokenAiEvidence[] = [];
  if (detailsRow?.details) {
    const categories = Array.isArray(detailsRow.details.categories)
      ? detailsRow.details.categories.slice(0, 5).join(", ")
      : undefined;
    evidence.push({
      type: "metadata",
      label: "Token metadata",
      value: token.name || token.symbol || address,
      detail: categories ? `Categories: ${categories}` : "Metadata available.",
      timestamp: toDate(detailsRow.details.updatedAt),
      source: "Yoca token metadata",
    });
  } else if (metaRow) {
    evidence.push({
      type: "metadata",
      label: "Token identity",
      value: `${metaRow.name} (${metaRow.symbol})`,
      timestamp: toDate(metaRow.updatedAt),
      source: "Yoca token metadata",
    });
  }

  if (market) {
    const marketRecord = market as Record<string, unknown>;
    evidence.push(
      {
        type: "market",
        label: "Price",
        value: compactCurrency(marketRecord.priceUsd),
        detail: `24h change: ${percent(marketRecord.priceChangePercentage24h) ?? "unavailable"}.`,
        timestamp: toDate(marketRecord.updatedAt),
        source: "Yoca market data",
      },
      {
        type: "market",
        label: "Market cap / FDV",
        value: compactCurrency(marketRecord.marketCap),
        detail: `FDV: ${compactCurrency(marketRecord.fullyDilutedValuation) ?? "unavailable"}. Rank: ${marketRecord.marketCapRank ?? "unavailable"}.`,
        timestamp: toDate(marketRecord.updatedAt),
        source: "Yoca market data",
      },
      {
        type: "market",
        label: "24h volume",
        value: compactCurrency(marketRecord.volume24h),
        detail: `24h high/low: ${compactCurrency(marketRecord.high24h) ?? "unavailable"} / ${compactCurrency(marketRecord.low24h) ?? "unavailable"}.`,
        timestamp: toDate(marketRecord.updatedAt),
        source: "Yoca market data",
      },
    );
  } else {
    missingSections.push({
      section: "market",
      available: false,
      reason: "Market data is not available for this token right now.",
    });
  }

  if (chartRes.ok && chartRes.value.evidence) {
    evidence.push(chartRes.value.evidence);
  } else {
    missingSections.push({
      section: "chart",
      available: false,
      reason: "Chart data is missing or too sparse for the selected timeframe.",
    });
  }

  if (holderStats) {
    const stats = holderStats as Record<string, unknown>;
    evidence.push({
      type: "holders",
      label: "Holder concentration",
      value: `${compactNumber(stats.holdersCount) ?? "Unknown"} holders`,
      detail: `Top 10 holders: ${percent(stats.top10Percent) ?? "unavailable"} of supply.`,
      timestamp: toDate(stats.updatedAt),
      source: "Yoca holder stats",
    });
  }

  const news =
    input.includeNews && token.symbol && token.name
      ? await safe("news", () =>
          getRssTokenNews(
            { address, symbol: token.symbol!, name: token.name! },
            { maxArticles: 20 },
          ),
        )
      : null;

  let latestNews: TokenNewsArticle[] = [];
  if (news?.ok) {
    latestNews = dedupeArticles(news.value.articles).slice(0, 5);
    latestNews.forEach((article) => {
      evidence.push({
        type: "news",
        label: article.title,
        detail: article.description?.slice(0, 260),
        url: article.url,
        timestamp: article.publishedAt ?? undefined,
        source: article.source,
      });
    });
  } else if (news && !news.ok) {
    missingSections.push(news.missing);
  } else if (!input.includeNews) {
    missingSections.push({
      section: "news",
      available: false,
      reason: "News collection was disabled for this request.",
    });
  }

  const chartNewsMarkers = groupArticlesByDate(latestNews, input.timeframe);
  chartNewsMarkers.forEach((event) => {
    evidence.push({
      type: "news",
      label: `News marker: ${event.date}`,
      value: `${event.articleCount} article${event.articleCount === 1 ? "" : "s"}`,
      detail: event.topTitles.join(" | "),
      timestamp: event.timestamp,
      source: "Yoca chart news grouping",
    });
  });

  const volatility =
    input.includeVolatility && token.symbol && token.name
      ? await safe("volatility", () =>
          getTokenPriceVolatilityEvents({
            address,
            symbol: token.symbol!.toUpperCase(),
            name: token.name!,
            thresholdPercent: 10,
            timeframe: input.timeframe === "24h" ? "24h" : input.timeframe === "1y" ? "daily" : "hourly",
            window: "auto",
          }),
        )
      : null;

  const volatilityEvents = volatility?.ok
    ? volatility.value.events.slice(0, 5)
    : [];
  volatilityEvents.forEach((event) => {
    evidence.push({
      type: "volatility",
      label: event.type === "price_spike" ? "Price spike" : "Price drop",
      value: percent(event.changePercent),
      detail: `${event.window} move from ${compactCurrency(event.before) ?? event.before} to ${compactCurrency(event.after) ?? event.after}. Severity: ${event.severity}.`,
      timestamp: event.timestamp,
      source: "Yoca volatility detector",
    });
  });
  if (volatility && !volatility.ok) missingSections.push(volatility.missing);

  const poolsRes = await safe("pool", () => getTokenTopPools(address));
  const pools = poolsRes.ok ? poolsRes.value.slice(0, 3) : [];
  if (!poolsRes.ok) missingSections.push(poolsRes.missing);

  pools.forEach((pool) => {
    const data = (pool as { data?: Record<string, unknown> }).data ?? {};
    evidence.push({
      type: "pool",
      label: String(data.poolName ?? "Top pool"),
      value: compactCurrency(data.liquidityUsd),
      detail: `DEX: ${data.dexId ?? "unknown"}. 24h volume: ${compactCurrency(data.volumeUsd24h) ?? "unavailable"}. 24h buys/sells: ${data.buys24h ?? "?"}/${data.sells24h ?? "?"}.`,
      timestamp: toDate(data.updatedAt ?? data.topPoolsUpdatedAt),
      source: "Yoca pool data",
    });
  });

  const topPoolAddress =
    (pools[0] as { data?: Record<string, unknown>; rankInfo?: Record<string, unknown> } | undefined)?.data
      ?.poolAddress ??
    (pools[0] as { rankInfo?: Record<string, unknown> } | undefined)?.rankInfo
      ?.poolAddress;
  const tradesRes =
    typeof topPoolAddress === "string"
      ? await safe("trades", () => getPoolTrades24h(topPoolAddress))
      : null;
  const recentTrades = tradesRes?.ok ? tradesRes.value.slice(0, 10) : [];
  if (tradesRes && !tradesRes.ok) missingSections.push(tradesRes.missing);

  recentTrades.slice(0, 3).forEach((trade) => {
    const record = trade as Record<string, unknown>;
    evidence.push({
      type: "trades",
      label: "Recent pool trade",
      value: compactCurrency(record.volumeInUsd),
      detail: `Tx ${String(record.transactionHash ?? "").slice(0, 8)}...`,
      timestamp: toDate(record.blockTimestamp),
      source: "Yoca pool trades",
    });
  });

  const sources: TokenAiSource[] = latestNews.map((article) => ({
    title: article.title,
    publisher: article.source,
    url: article.url,
    publishedAt: article.publishedAt,
    snippet: article.description?.slice(0, 240),
    sourceType: "external",
  }));

  return {
    token,
    timeframe: input.timeframe,
    market,
    metadata: detailsRow?.details ?? metaRow ?? null,
    chartSummary,
    latestNews,
    chartNewsMarkers,
    volatilityEvents,
    holderStats,
    topHolders,
    pools,
    recentTrades,
    evidence: evidence.slice(0, 30),
    sources,
    missingSections,
    builtAt: new Date().toISOString(),
  };
}
