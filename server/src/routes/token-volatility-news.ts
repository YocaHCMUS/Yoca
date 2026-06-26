import { solanaBase58Schema } from "@sv/middlewares/validation.js";
import { getRssTokenNews, type RelatedTokenNewsArticle } from "@sv/services/rss-news.service.js";
import {
    getTokenPriceVolatilityEvents,
    type TokenPriceVolatilityEvent,
    type TokenVolatilityTimeframe,
    type TokenVolatilityWindow,
} from "@sv/services/tokens/token-volatility.js";
import {
    getTokenVolatilityNewsCacheExpiresAt,
    readTokenVolatilityNewsCache,
    writeTokenVolatilityNewsCache,
    type TokenVolatilityNewsCacheKey,
} from "@sv/services/tokens/token-volatility-news-cache.js";
import {
    summarizeTokenVolatilityNews,
    type TokenVolatilityNewsSummary,
} from "@sv/services/tokens/token-volatility-summary.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

const supportedTimeframes = ["24h", "hourly", "daily"] as const;
const supportedWindows = ["auto", "adjacent", "15m", "1h", "6h", "24h"] as const;
const DEFAULT_MAX_EVENTS_WITH_NEWS = 5;
const MAX_RELATED_ARTICLES_PER_EVENT = 5;

type TokenVolatilityNewsEvent = TokenPriceVolatilityEvent & {
  relatedNews: RelatedTokenNewsArticle[];
};

type TokenVolatilityNewsData = {
  token: {
    address: string;
    symbol: string;
    name: string;
  };
  thresholdPercent: number;
  timeframe: TokenVolatilityTimeframe;
  window: TokenVolatilityWindow;
  metric: "price";
  updatedAt: string;
  dataPointsAnalyzed: number;
  rawEventsDetected: number;
  groupedEventsReturned: number;
  evaluatedWindows: string[];
  relatedNewsWindowHours: number;
  meta: {
    providersUsed: Array<"rss" | "brave">;
    braveFallbackUsed: boolean;
    braveNewsUsed?: boolean;
    braveWebFallbackUsed?: boolean;
    sourceTypeCounts: {
      news: number;
      web_mention: number;
      project_update: number;
    };
  };
  summary: TokenVolatilityNewsSummary | null;
  events: TokenVolatilityNewsEvent[];
};

type TokenVolatilityNewsResponseData = TokenVolatilityNewsData & {
  cache: {
    hit: boolean;
    expiresAt: string;
  };
};

const tokenVolatilityNewsQuerySchema = z.object({
  address: solanaBase58Schema,
  symbol: z.string().trim().min(1).max(24),
  name: z.string().trim().min(1).max(128),
  threshold: z.coerce.number().positive().default(20),
  timeframe: z.enum(supportedTimeframes).default("24h"),
  window: z.enum(supportedWindows).default("auto"),
  maxEventsWithNews: z.coerce
    .number()
    .int()
    .min(0)
    .max(10)
    .default(DEFAULT_MAX_EVENTS_WITH_NEWS),
  forceRefresh: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value == "true"),
  includeSummary: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value == "true"),
});

function getDefaultRelatedNewsWindowHours(
  timeframe: TokenVolatilityTimeframe,
) {
  return timeframe == "daily" ? 72 : 24;
}

async function getPossibleRelatedNewsForEvent({
  event,
  token,
  timeframe,
}: {
  event: TokenPriceVolatilityEvent;
  token: { address: string; symbol: string; name: string };
  timeframe: TokenVolatilityTimeframe;
}) {
  const relatedNewsWindowHours = getDefaultRelatedNewsWindowHours(timeframe);

  const news = await getRssTokenNews(token, {
    eventAt: event.timestamp,
    windowHours: relatedNewsWindowHours,
    preferSearch: true,
    maxArticles: MAX_RELATED_ARTICLES_PER_EVENT,
    strictMode: true,
    searchMode: "event",
  });
  const articles: RelatedTokenNewsArticle[] = [];

  for (const article of news.articles) {
    if ("type" in article && article.type == "related_news") {
      articles.push({
        type: "related_news",
        title: article.title,
        url: article.url,
        source: article.source,
        publishedAt: article.publishedAt,
        description: article.description,
        score: article.score,
        matchedBy: article.matchedBy,
        sourceType: article.sourceType,
        imageUrl: article.imageUrl,
        favicon: article.favicon,
        timeDistanceHours: article.timeDistanceHours,
        confidence: article.confidence,
      });
    }
  }

  return {
    articles,
    meta: news.meta,
  };
}

const app = new Hono().get("/", async (c) => {
  const parsed = tokenVolatilityNewsQuerySchema.safeParse(c.req.query());

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
    threshold,
    timeframe,
    window,
    maxEventsWithNews,
    forceRefresh,
    includeSummary,
  } = parsed.data;

  const token = {
    address,
    symbol: symbol.trim().toUpperCase(),
    name: name.trim(),
  };
  const volatilityTimeframe: TokenVolatilityTimeframe = timeframe;
  const relatedNewsWindowHours =
    getDefaultRelatedNewsWindowHours(volatilityTimeframe);
  const cacheKey: TokenVolatilityNewsCacheKey = {
    tokenAddress: address,
    symbol: token.symbol,
    name: token.name,
    thresholdPercent: threshold,
    timeframe: volatilityTimeframe,
    detectionWindow: window,
    maxEventsWithNews,
    includeSummary,
  };

  try {
    if (!forceRefresh) {
      try {
        const cached =
          await readTokenVolatilityNewsCache<TokenVolatilityNewsData>(
            cacheKey,
          );

        if (cached) {
          console.info("[token-volatility-news] cache hit", {
            token,
            thresholdPercent: threshold,
            timeframe,
            window,
            maxEventsWithNews,
            includeSummary,
            expiresAt: cached.expiresAt,
          });

          const responseData: TokenVolatilityNewsResponseData = {
            ...cached.data,
            cache: {
              hit: true,
              expiresAt: cached.expiresAt,
            },
          };

          return c.json(
            {
              success: true,
              data: responseData,
            },
            statusCode.Ok,
          );
        }
      } catch (err) {
        console.warn("[token-volatility-news] cache read failed", {
          token,
          thresholdPercent: threshold,
          timeframe,
          window,
          maxEventsWithNews,
          includeSummary,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      console.info("[token-volatility-news] cache bypass requested", {
        token,
        thresholdPercent: threshold,
        timeframe,
        window,
        maxEventsWithNews,
        includeSummary,
      });
    }

    const volatility = await getTokenPriceVolatilityEvents({
      ...token,
      thresholdPercent: threshold,
      timeframe: volatilityTimeframe,
      window,
    });

    console.info("[token-volatility-news] volatility events", {
      token,
      timeframe,
      thresholdPercent: threshold,
      window,
      volatilityEventsFound: volatility.events.length,
      maxEventsWithNews,
    });

    const eventsWithRelatedNews: TokenVolatilityNewsEvent[] = [];
    const providersUsed = new Set<"rss" | "brave">(["rss"]);
    let braveFallbackUsed = false;
    let braveNewsUsed = false;
    let braveWebFallbackUsed = false;
    const sourceTypeCounts = {
      news: 0,
      web_mention: 0,
      project_update: 0,
    };

    for (const [index, event] of volatility.events.entries()) {
      if (index >= maxEventsWithNews) {
        eventsWithRelatedNews.push({ ...event, relatedNews: [] });
        continue;
      }

      try {
        console.info("[token-volatility-news] searching possible related news", {
          eventId: event.id,
          eventTimestamp: event.timestamp,
          relatedNewsWindowHours,
        });

        const related = await getPossibleRelatedNewsForEvent({
          event,
          token,
          timeframe: volatilityTimeframe,
        });

        console.info("[token-volatility-news] possible related news", {
          eventId: event.id,
          eventTimestamp: event.timestamp,
          relatedNewsCount: related.articles.length,
          braveFallbackUsed: related.meta.braveFallbackUsed,
          braveNewsUsed: related.meta.braveNewsUsed,
          braveWebFallbackUsed: related.meta.braveWebFallbackUsed,
          providersUsed: related.meta.providersUsed,
          sourceTypeCounts: related.meta.sourceTypeCounts,
        });
        for (const provider of related.meta.providersUsed) {
          providersUsed.add(provider);
        }
        braveFallbackUsed = braveFallbackUsed || related.meta.braveFallbackUsed;
        braveNewsUsed = braveNewsUsed || related.meta.braveNewsUsed;
        braveWebFallbackUsed =
          braveWebFallbackUsed || related.meta.braveWebFallbackUsed;
        sourceTypeCounts.news += related.meta.sourceTypeCounts.news;
        sourceTypeCounts.web_mention +=
          related.meta.sourceTypeCounts.web_mention;
        sourceTypeCounts.project_update +=
          related.meta.sourceTypeCounts.project_update;

        eventsWithRelatedNews.push({
          ...event,
          relatedNews: related.articles,
        });
      } catch (err) {
        console.warn("[token-volatility-news] related news failed", {
          eventId: event.id,
          eventTimestamp: event.timestamp,
          error: err instanceof Error ? err.message : String(err),
        });

        eventsWithRelatedNews.push({ ...event, relatedNews: [] });
      }
    }
    const dataWithoutSummary = {
      ...volatility,
      window,
      relatedNewsWindowHours,
      meta: {
        providersUsed: [...providersUsed],
        braveFallbackUsed,
        braveNewsUsed,
        braveWebFallbackUsed,
        sourceTypeCounts,
      },
      events: eventsWithRelatedNews,
    };
    const summary = includeSummary
      ? await summarizeTokenVolatilityNews(dataWithoutSummary)
      : null;
    const freshData: TokenVolatilityNewsData = {
      ...dataWithoutSummary,
      summary,
    };
    const expiresAt = getTokenVolatilityNewsCacheExpiresAt(
      volatilityTimeframe,
    );

    try {
      await writeTokenVolatilityNewsCache(cacheKey, freshData, expiresAt);
    } catch (err) {
      console.warn("[token-volatility-news] cache write failed", {
        token,
        thresholdPercent: threshold,
        timeframe,
        window,
        maxEventsWithNews,
        includeSummary,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const responseData: TokenVolatilityNewsResponseData = {
      ...freshData,
      cache: {
        hit: false,
        expiresAt: expiresAt.toISOString(),
      },
    };

    return c.json(
      {
        success: true,
        data: responseData,
      },
      statusCode.Ok,
    );
  } catch (err) {
    console.error("[token-volatility-news] error:", err);
    return c.json(
      {
        ...setErr("INTERNAL_SERVER_ERR"),
        success: false,
      },
      statusCode.InternalServerError,
    );
  }
});

export type TokenVolatilityNewsAppType = typeof app;
export default app;
