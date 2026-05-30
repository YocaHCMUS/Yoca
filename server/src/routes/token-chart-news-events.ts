import { solanaBase58Schema } from "@sv/middlewares/validation.js";
import {
  getRssTokenNews,
  type TokenNewsArticle,
} from "@sv/services/rss-news.service.js";
import {
  getTokenChartNewsEventsCacheExpiresAt,
  readTokenChartNewsEventsCache,
  writeTokenChartNewsEventsCache,
  type TokenChartNewsEventsCacheKey,
  type TokenChartNewsTimeframe,
} from "@sv/services/tokens/token-chart-news-events-cache.js";
import {
  summarizeTokenChartNewsEvent,
  type TokenChartNewsEventSummary,
} from "@sv/services/tokens/token-chart-news-summary.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

interface TokenChartNewsEvent {
  date: string;
  timestamp: string;
  articleCount: number;
  summary: TokenChartNewsEventSummary | null;
  articles: TokenNewsArticle[];
}

interface TokenChartNewsEventsData {
  token: {
    address: string;
    symbol: string;
    name: string;
  };
  timeframe: TokenChartNewsTimeframe;
  updatedAt: string;
  events: TokenChartNewsEvent[];
}

const supportedTimeframes = ["24h", "7d", "1m", "3m", "1y"] as const;
const MAX_CHART_NEWS_EVENTS = 30;
const MAX_ARTICLES_PER_EVENT = 10;
const MAX_EVENTS_TO_SUMMARIZE_WITHOUT_DATE = 5;

const timeframeDays: Record<TokenChartNewsTimeframe, number> = {
  "24h": 1,
  "7d": 7,
  "1m": 30,
  "3m": 90,
  "1y": 365,
};

const tokenChartNewsEventsQuerySchema = z.object({
  address: solanaBase58Schema,
  symbol: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(128),
  timeframe: z.enum(supportedTimeframes).default("1m"),
  includeSummary: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  forceRefresh: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

function getArticleTimestamp(article: TokenNewsArticle) {
  if (!article.publishedAt) return 0;
  const timestamp = Date.parse(article.publishedAt);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function getUtcDateKey(timestamp: number) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function getUtcDateTimestamp(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).toISOString();
}

function hasCurrentSummaryShape(summary: TokenChartNewsEventSummary | null) {
  return Boolean(
    summary &&
      typeof summary.headline === "string" &&
      typeof summary.tldr === "string" &&
      Array.isArray(summary.bullets) &&
      Array.isArray(summary.themes) &&
      typeof summary.confidence === "string" &&
      typeof summary.riskNote === "string",
  );
}

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["ref", "fbclid", "gclid"].includes(key.toLowerCase())
      ) {
        url.searchParams.delete(key);
      }
    }
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, "").toLowerCase();
  }
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/<[^>]*>/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeTokenNewsArticles(articles: TokenNewsArticle[]) {
  const byUrl = new Map<string, TokenNewsArticle>();

  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = byUrl.get(key);
    if (!existing || article.score > existing.score) {
      byUrl.set(key, article);
    }
  }

  const byTitle = new Map<string, TokenNewsArticle>();
  for (const article of byUrl.values()) {
    const key = normalizeTitle(article.title);
    const existing = byTitle.get(key);
    if (!existing || article.score > existing.score) {
      byTitle.set(key, article);
    }
  }

  return [...byTitle.values()];
}

function getDateMidpoint(date: string) {
  return `${date}T12:00:00.000Z`;
}

async function expandEventArticlesForSummary({
  event,
  token,
}: {
  event: TokenChartNewsEvent;
  token: { address: string; symbol: string; name: string };
}) {
  try {
    const expandedNews = await getRssTokenNews(token, {
      eventAt: getDateMidpoint(event.date),
      windowHours: 36,
      preferSearch: true,
      maxArticles: MAX_ARTICLES_PER_EVENT,
      strictMode: true,
      searchMode: "chart",
    });

    const articles = dedupeTokenNewsArticles([
      ...event.articles,
      ...expandedNews.articles,
    ])
      .sort((a, b) => {
        const dateDiff = getArticleTimestamp(b) - getArticleTimestamp(a);
        if (dateDiff !== 0) return dateDiff;
        return b.score - a.score;
      })
      .slice(0, MAX_ARTICLES_PER_EVENT);

    return {
      ...event,
      articleCount: Math.max(event.articleCount, articles.length),
      articles,
    };
  } catch (err) {
    console.warn("[token-chart-news-events] date-specific news expansion failed", {
      date: event.date,
      token,
      error: err instanceof Error ? err.message : String(err),
    });

    return {
      ...event,
      articles: event.articles.slice(0, MAX_ARTICLES_PER_EVENT),
    };
  }
}

async function addSummaries(
  data: TokenChartNewsEventsData,
  summaryDate?: string,
): Promise<TokenChartNewsEventsData> {
  const events: TokenChartNewsEvent[] = [];
  const eventsToSummarize = summaryDate
    ? data.events.filter((event) => event.date === summaryDate)
    : data.events.slice(0, MAX_EVENTS_TO_SUMMARIZE_WITHOUT_DATE);
  const summarizeDates = new Set(eventsToSummarize.map((event) => event.date));
  const token = {
    address: data.token.address,
    symbol: data.token.symbol,
    name: data.token.name,
  };

  for (const event of data.events) {
    if (!summarizeDates.has(event.date)) {
      events.push(event);
      continue;
    }

    const expandedEvent = summaryDate
      ? await expandEventArticlesForSummary({ event, token })
      : event;

    events.push({
      ...expandedEvent,
      summary: await summarizeTokenChartNewsEvent({
        token: {
          name: data.token.name,
          symbol: data.token.symbol,
        },
        date: expandedEvent.date,
        articleCount: expandedEvent.articleCount,
        articles: expandedEvent.articles,
      }),
    });
  }

  return {
    ...data,
    events,
  };
}

function groupArticlesByDate(
  articles: TokenNewsArticle[],
  timeframe: TokenChartNewsTimeframe,
  date?: string,
) {
  const cutoffMs = Date.now() - timeframeDays[timeframe] * 24 * 60 * 60 * 1000;
  const groups = new Map<string, TokenNewsArticle[]>();

  for (const article of articles) {
    const timestamp = getArticleTimestamp(article);
    if (timestamp <= 0 || timestamp < cutoffMs) continue;

    const dateKey = getUtcDateKey(timestamp);
    const group = groups.get(dateKey) ?? [];
    group.push(article);
    groups.set(dateKey, group);
  }

  return [...groups.entries()]
    .map(([date, groupedArticles]) => {
      const sortedArticles = [...groupedArticles]
        .sort((a, b) => getArticleTimestamp(b) - getArticleTimestamp(a))
        .slice(0, MAX_ARTICLES_PER_EVENT);
      const eventWithoutSummary = {
        date,
        timestamp: getUtcDateTimestamp(date),
        articleCount: groupedArticles.length,
        articles: sortedArticles,
      };

      return {
        ...eventWithoutSummary,
        summary: null,
      };
    })
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .filter((event) => !date || event.date === date)
    .slice(0, MAX_CHART_NEWS_EVENTS);
}

async function buildFreshChartNewsEvents({
  address,
  symbol,
  name,
  timeframe,
  includeSummary,
  date,
}: {
  address: string;
  symbol: string;
  name: string;
  timeframe: TokenChartNewsTimeframe;
  includeSummary: boolean;
  date?: string;
}): Promise<TokenChartNewsEventsData> {
  const news = await getRssTokenNews(
    { address, symbol, name },
    { maxArticles: 120 },
  );

  const data: TokenChartNewsEventsData = {
    token: {
      address,
      symbol: news.token.symbol,
      name: news.token.name,
    },
    timeframe,
    updatedAt: new Date().toISOString(),
    events: groupArticlesByDate(news.articles, timeframe, date),
  };

  return includeSummary ? addSummaries(data, date) : data;
}

const app = new Hono().get("/", async (c) => {
  const parsed = tokenChartNewsEventsQuerySchema.safeParse(c.req.query());

  if (!parsed.success) {
    return c.json(
      {
        ...setErr("VALIDATION_ERR"),
        message: "Invalid query parameters",
        details: parsed.error.issues,
      },
      statusCode.BadRequest,
    );
  }

  const {
    address,
    symbol,
    name,
    timeframe,
    includeSummary,
    forceRefresh,
    date,
  } = parsed.data;
  const cacheKey: TokenChartNewsEventsCacheKey = {
    tokenAddress: address,
    symbol: symbol.trim().toUpperCase(),
    name: name.trim(),
    timeframe,
    eventDate: date ?? "",
    includeSummary,
  };

  try {
    if (!forceRefresh) {
      try {
        const cached =
          await readTokenChartNewsEventsCache<TokenChartNewsEventsData>(
            cacheKey,
          );
        if (cached) {
          const summaryCacheIsCurrent =
            !includeSummary ||
            cached.data.events.every((event) =>
              hasCurrentSummaryShape(event.summary),
            );

          if (!summaryCacheIsCurrent) {
            console.info(
              "[token-chart-news-events] stale summary cache ignored",
              {
                address,
                symbol: cacheKey.symbol,
                timeframe,
                date,
              },
            );
          } else {
            console.info("[token-chart-news-events] cache hit", {
              address,
              symbol: cacheKey.symbol,
              timeframe,
              includeSummary,
              date,
              events: cached.data.events.length,
            });

            return c.json({ success: true, data: cached.data }, statusCode.Ok);
          }
        }
      } catch (err) {
        console.warn("[token-chart-news-events] cache read failed", {
          address,
          symbol: cacheKey.symbol,
          timeframe,
          includeSummary,
          date,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      console.info("[token-chart-news-events] cache bypass requested", {
        address,
        symbol: cacheKey.symbol,
        timeframe,
        includeSummary,
        date,
      });
    }

    if (includeSummary && !forceRefresh) {
      try {
        const baseCached =
          await readTokenChartNewsEventsCache<TokenChartNewsEventsData>({
            ...cacheKey,
            eventDate: "",
            includeSummary: false,
          });
        if (baseCached) {
          const baseData = date
            ? {
                ...baseCached.data,
                events: baseCached.data.events.filter(
                  (event) => event.date === date,
                ),
              }
            : baseCached.data;
          const summarized = await addSummaries(baseData, date);
          const expiresAt = getTokenChartNewsEventsCacheExpiresAt(timeframe);
          await writeTokenChartNewsEventsCache(cacheKey, summarized, expiresAt);

          return c.json({ success: true, data: summarized }, statusCode.Ok);
        }
      } catch (err) {
        console.warn("[token-chart-news-events] base cache reuse failed", {
          address,
          symbol: cacheKey.symbol,
          timeframe,
          date,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const data = await buildFreshChartNewsEvents({
      address,
      symbol: cacheKey.symbol,
      name: cacheKey.name,
      timeframe,
      includeSummary,
      date,
    });
    const expiresAt = getTokenChartNewsEventsCacheExpiresAt(timeframe);

    try {
      await writeTokenChartNewsEventsCache(cacheKey, data, expiresAt);
    } catch (err) {
      console.warn("[token-chart-news-events] cache write failed", {
        address,
        symbol: cacheKey.symbol,
        timeframe,
        includeSummary,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    console.info("[token-chart-news-events] events built", {
      address,
      symbol: cacheKey.symbol,
      timeframe,
      includeSummary,
      date,
      events: data.events.length,
    });

    return c.json({ success: true, data }, statusCode.Ok);
  } catch (err) {
    console.error("[token-chart-news-events] error:", err);
    return c.json(
      {
        ...setErr("INTERNAL_SERVER_ERR"),
        success: false,
      },
      statusCode.InternalServerError,
    );
  }
});

export type TokenChartNewsEventsAppType = typeof app;
export default app;
