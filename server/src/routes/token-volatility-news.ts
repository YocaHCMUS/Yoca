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
import { summarizeTokenVolatilityNews } from "@sv/services/tokens/token-volatility-summary.js";
import { setErr } from "@sv/util/errors.js";
import { statusCode } from "@sv/util/responses.js";
import { Hono } from "hono";
import z from "zod";

const supportedTimeframes = ["24h", "hourly", "daily"] as const;
const supportedWindows = ["auto", "adjacent", "15m", "1h", "6h", "24h"] as const;
const DEFAULT_MAX_EVENTS_WITH_NEWS = 5;
const MAX_RELATED_ARTICLES_PER_EVENT = 5;

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
    .transform((value) => value === "true"),
  includeSummary: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

function getDefaultRelatedNewsWindowHours(
  timeframe: TokenVolatilityTimeframe,
) {
  return timeframe === "daily" ? 72 : 24;
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

  return {
    articles: news.articles as RelatedTokenNewsArticle[],
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
  const volatilityTimeframe = timeframe as TokenVolatilityTimeframe;
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
          await readTokenVolatilityNewsCache<Record<string, unknown>>(
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

          return c.json(
            {
              success: true,
              data: {
                ...cached.data,
                cache: {
                  hit: true,
                  expiresAt: cached.expiresAt,
                },
              },
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
      window: window as TokenVolatilityWindow,
    });

    console.info("[token-volatility-news] volatility events", {
      token,
      timeframe,
      thresholdPercent: threshold,
      window,
      volatilityEventsFound: volatility.events.length,
      maxEventsWithNews,
    });

    const eventsWithRelatedNews = [];

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
          braveFallbackUsed: related.meta.fallbackUsed,
        });

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
      events: eventsWithRelatedNews,
    };
    const summary = includeSummary
      ? await summarizeTokenVolatilityNews(dataWithoutSummary)
      : null;
    const freshData = {
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

    return c.json(
      {
        success: true,
        data: {
          ...freshData,
          cache: {
            hit: false,
            expiresAt: expiresAt.toISOString(),
          },
        },
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
