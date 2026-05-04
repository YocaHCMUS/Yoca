import crypto from "crypto";
import { db } from "@sv/db/index.js";
import { newsBatches, newsArticles, tokenMarketChartDaily } from "@sv/db/schema.js";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { NewsArticleExpansion, NewsTokenContext } from "@sv/types/news.types.js";
import { excluded } from "@sv/util/orm-sql.js";

const N8N_LATEST_NEWS_URL = process.env.N8N_LATEST_NEWS_URL ||
    "http://localhost:5678/webhook/latest-news";

const NEWS_CACHE_TTL_MS = process.env.NEWS_CACHE_TTL_MS ? parseInt(process.env.NEWS_CACHE_TTL_MS) : 3 * 60 * 60 * 1000; // 3 hours

function parseNewsTimestamp(value: unknown): Date | null {
    if (value == null || value === "") return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
        const millis = value < 1e12 ? value * 1000 : value;
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        if (/^\d+$/.test(trimmed)) {
            const numeric = Number(trimmed);
            return parseNewsTimestamp(numeric);
        }

        const date = new Date(trimmed);
        return Number.isNaN(date.getTime()) ? null : date;
    }

    return null;
}

function extractEntriesFromN8n(respBody: any) {
    if (!respBody) return [];
    if (Array.isArray(respBody.entry)) return respBody.entry;
    if (Array.isArray(respBody.entries)) return respBody.entries;
    if (respBody.output && Array.isArray(respBody.output.entry)) return respBody.output.entry;
    if (respBody[0] && Array.isArray(respBody[0].entry)) return respBody[0].entry;
    for (const key of Object.keys(respBody)) {
        if (Array.isArray(respBody[key]) && respBody[key].length > 0 && typeof respBody[key][0] === "object") {
            return respBody[key];
        }
    }
    return [];
}

function normalizeExtraSnippets(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((snippet): snippet is string => typeof snippet === "string" && snippet.trim().length > 0);
}

function toContextPayload(rows: Array<{ unixTimestampMs: number; price: number; marketCap: number }>): NewsTokenContext {
    return {
        labels: rows.map((row) => new Date(row.unixTimestampMs).toISOString().slice(0, 10)),
        priceSeries: rows.map((row) => Number(row.price)),
        marketCapSeries: rows.map((row) => Number(row.marketCap)),
    };
}

async function getCachedTokenHistoricalContext(tokenAddress: string, publishedAt: Date | null, days = 5) {
    const dayMs = 24 * 60 * 60 * 1000;
    const halfWindow = Math.floor(days / 2);

    let rows = [] as Array<{ unixTimestampMs: number; price: number; marketCap: number }>;

    if (publishedAt) {
        rows = await db
            .select({
                unixTimestampMs: tokenMarketChartDaily.unixTimestampMs,
                price: tokenMarketChartDaily.price,
                marketCap: tokenMarketChartDaily.marketCap,
            })
            .from(tokenMarketChartDaily)
            .where(
                and(
                    eq(tokenMarketChartDaily.address, tokenAddress),
                    gte(tokenMarketChartDaily.unixTimestampMs, publishedAt.getTime() - halfWindow * dayMs),
                    lte(tokenMarketChartDaily.unixTimestampMs, publishedAt.getTime() + halfWindow * dayMs),
                ),
            )
            .orderBy(tokenMarketChartDaily.unixTimestampMs);
    }

    if (rows.length === 0) {
        rows = await db
            .select({
                unixTimestampMs: tokenMarketChartDaily.unixTimestampMs,
                price: tokenMarketChartDaily.price,
                marketCap: tokenMarketChartDaily.marketCap,
            })
            .from(tokenMarketChartDaily)
            .where(eq(tokenMarketChartDaily.address, tokenAddress))
            .orderBy(desc(tokenMarketChartDaily.unixTimestampMs))
            .limit(days)
            .then((latestRows) => latestRows.reverse()) as Array<{ unixTimestampMs: number; price: number; marketCap: number }>;
    }

    if (rows.length === 0) return null;

    return toContextPayload(rows);
}

export async function storeFilteredNewsBatch(
    address: string,
    symbol: string,
    name: string,
    entries: Array<Record<string, unknown>>,
) {
    const [batch] = await db
        .insert(newsBatches)
        .values({ address, symbol, name })
        .returning();

    const batchId = (batch as any).id as number;

    const rows = entries.map((e) => {
        const title = (e.title as string) || "";
        const url = (e.url as string) || "";
        const contentHash = crypto
            .createHash("sha256")
            .update(url + "|" + title)
            .digest("hex");

        return {
            batchId,
            title: title.slice(0, 512),
            url: url.slice(0, 1024),
            description: (e.description as string) || null,
            publishedAt: parseNewsTimestamp(e.timestamp),
            sourceName: (e.meta && (e.meta as any).source) || null,
            faviconUrl: (e.meta && (e.meta as any).favicon) || null,
            extraSnippets: normalizeExtraSnippets(e.extra_snippets),
            contentHash
        };
    });

    if (rows.length === 0) {
        return { received: 0, stored: 0, batchId };
    }

    await db.insert(newsArticles).values(rows).onConflictDoUpdate({
        target: [newsArticles.contentHash],
        set: {
            batchId: excluded(newsArticles.batchId),
            title: excluded(newsArticles.title),
            url: excluded(newsArticles.url),
            description: excluded(newsArticles.description),
            publishedAt: excluded(newsArticles.publishedAt),
            sourceName: excluded(newsArticles.sourceName),
            faviconUrl: excluded(newsArticles.faviconUrl),
            extraSnippets: excluded(newsArticles.extraSnippets),
        },
    });

    const storedRows = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.batchId, batchId));

    return { received: rows.length, stored: storedRows.length, batchId };
}

export async function getExpandedNewsArticle(contentHash: string): Promise<NewsArticleExpansion | null> {
    const rows = await db
        .select({
            contentHash: newsArticles.contentHash,
            title: newsArticles.title,
            url: newsArticles.url,
            description: newsArticles.description,
            publishedAt: newsArticles.publishedAt,
            sourceName: newsArticles.sourceName,
            faviconUrl: newsArticles.faviconUrl,
            extraSnippets: newsArticles.extraSnippets,
            tokenAddress: newsBatches.address,
            tokenSymbol: newsBatches.symbol,
            tokenName: newsBatches.name,
        })
        .from(newsArticles)
        .innerJoin(newsBatches, eq(newsArticles.batchId, newsBatches.id))
        .where(eq(newsArticles.contentHash, contentHash))
        .limit(1);

    const article = rows[0];
    if (!article) return null;

    const context = await getCachedTokenHistoricalContext(article.tokenAddress, article.publishedAt ?? null, 5);

    return {
        article: {
            contentHash: article.contentHash,
            title: article.title,
            url: article.url,
            description: article.description ?? null,
            publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
            sourceName: article.sourceName ?? null,
            faviconUrl: article.faviconUrl ?? null,
        },
        token: {
            address: article.tokenAddress,
            symbol: article.tokenSymbol,
            name: article.tokenName,
        },
        extraSnippets: normalizeExtraSnippets(article.extraSnippets),
        context,
    };
}

async function fetchFromN8n(address: string, symbol: string, name: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 300_000);
    try {
        const resp = await fetch(N8N_LATEST_NEWS_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address, symbol, name }),
            signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!resp.ok) {
            throw new Error(`n8n responded ${resp.status}`);
        }
        const body = await resp.json();
        return extractEntriesFromN8n(body) as Array<Record<string, unknown>>;
    } finally {
        clearTimeout(timeout);
    }
}

async function getCachedNewsBatch(address: string) {
    // find latest batch for this address+symbol
    const rows = await db
        .select()
        .from(newsBatches)
        .where(eq(newsBatches.address, address))
        .orderBy(desc(newsBatches.createdAt))
        .limit(1);

    const latest = rows[0] as any | undefined;
    if (latest && latest.createdAt) {
        const age = Date.now() - new Date(latest.createdAt).getTime();
        if (age < NEWS_CACHE_TTL_MS) {
            const articles = await db
                .select()
                .from(newsArticles)
                .where(eq(newsArticles.batchId, latest.id));
            return { cached: true, entries: articles };
        }
    }

    throw new Error("No recent cached batch");
}

/**
 * Return cached articles if a recent batch exists.
 * Otherwise fetch from n8n, store batch/articles and return fetched entries.
 */
export async function getOrFetchNews(
    address: string,
    symbol: string,
    name: string,
) {
    try {
        return await getCachedNewsBatch(address);
    } catch (err) {
        console.info(`[news] no recent cached batch for ${address} (${symbol}), fetching from n8n...`);
    }

    // fetch from n8n and store
    const entries = await fetchFromN8n(address, symbol, name);
    await storeFilteredNewsBatch(address, symbol, name, entries);
    return { cached: false, entries };
}
