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
const MAX_ARTICLES_PER_EVENT = 6;

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
      typeof summary.riskNote === "string",
  );
}

async function addSummaries(
  data: TokenChartNewsEventsData,
): Promise<TokenChartNewsEventsData> {
  const events: TokenChartNewsEvent[] = [];

  for (const event of data.events) {
    events.push({
      ...event,
      summary: await summarizeTokenChartNewsEvent({
        token: {
          name: data.token.name,
          symbol: data.token.symbol,
        },
        date: event.date,
        articleCount: event.articleCount,
        articles: event.articles,
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
    .slice(0, MAX_CHART_NEWS_EVENTS);
}

async function buildFreshChartNewsEvents({
  address,
  symbol,
  name,
  timeframe,
  includeSummary,
}: {
  address: string;
  symbol: string;
  name: string;
  timeframe: TokenChartNewsTimeframe;
  includeSummary: boolean;
}): Promise<TokenChartNewsEventsData> {
  const news = await getRssTokenNews(
    { address, symbol, name },
    { maxArticles: 80 },
  );

  const data: TokenChartNewsEventsData = {
    token: {
      address,
      symbol: news.token.symbol,
      name: news.token.name,
    },
    timeframe,
    updatedAt: new Date().toISOString(),
    events: groupArticlesByDate(news.articles, timeframe),
  };

  return includeSummary ? addSummaries(data) : data;
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

  const { address, symbol, name, timeframe, includeSummary } = parsed.data;
  const cacheKey: TokenChartNewsEventsCacheKey = {
    tokenAddress: address,
    symbol: symbol.trim().toUpperCase(),
    name: name.trim(),
    timeframe,
    includeSummary,
  };

  try {
    try {
      const cached =
        await readTokenChartNewsEventsCache<TokenChartNewsEventsData>(cacheKey);
      if (cached) {
        const summaryCacheIsCurrent =
          !includeSummary ||
          cached.data.events.every((event) =>
            hasCurrentSummaryShape(event.summary),
          );

        if (!summaryCacheIsCurrent) {
          console.info("[token-chart-news-events] stale summary cache ignored", {
            address,
            symbol: cacheKey.symbol,
            timeframe,
          });
        } else {
          console.info("[token-chart-news-events] cache hit", {
            address,
            symbol: cacheKey.symbol,
            timeframe,
            includeSummary,
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
        error: err instanceof Error ? err.message : String(err),
      });
    }

    if (includeSummary) {
      try {
        const baseCached =
          await readTokenChartNewsEventsCache<TokenChartNewsEventsData>({
            ...cacheKey,
            includeSummary: false,
          });
        if (baseCached) {
          const summarized = await addSummaries(baseCached.data);
          const expiresAt = getTokenChartNewsEventsCacheExpiresAt(timeframe);
          await writeTokenChartNewsEventsCache(cacheKey, summarized, expiresAt);

          return c.json({ success: true, data: summarized }, statusCode.Ok);
        }
      } catch (err) {
        console.warn("[token-chart-news-events] base cache reuse failed", {
          address,
          symbol: cacheKey.symbol,
          timeframe,
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
