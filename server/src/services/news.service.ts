import crypto from "crypto";
import { db } from "@sv/db/index.js";
import { newsBatches, newsArticles } from "@sv/db/schema.js";
import { eq, desc } from "drizzle-orm";

const N8N_LATEST_NEWS_URL = process.env.N8N_LATEST_NEWS_URL ||
    "http://localhost:5678/webhook/latest-news";

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
            publishedAt: e.timestamp ? new Date(Number(e.timestamp)) : null,
            sourceName: (e.meta && (e.meta as any).source) || null,
            faviconUrl: (e.meta && (e.meta as any).favicon) || null,
            contentHash,
            raw: e,
        };
    });

    if (rows.length === 0) {
        return { received: 0, stored: 0, batchId };
    }

    await db.insert(newsArticles).values(rows).onConflictDoNothing();

    const storedRows = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.batchId, batchId));

    return { received: rows.length, stored: storedRows.length, batchId };
}

async function fetchFromN8n(address: string, symbol: string, name: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
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

/**
 * Return cached articles if a recent batch exists.
 * Otherwise fetch from n8n, store batch/articles and return fetched entries.
 */
export async function getOrFetchNews(
    address: string,
    symbol: string,
    name: string,
    ttlMs = 5 * 60 * 1000,
) {
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
        if (age < ttlMs) {
            const articles = await db
                .select()
                .from(newsArticles)
                .where(eq(newsArticles.batchId, latest.id));
            return { cached: true, entries: articles };
        }
    }

    // fetch from n8n and store
    const entries = await fetchFromN8n(address, symbol, name);
    await storeFilteredNewsBatch(address, symbol, name, entries);
    return { cached: false, entries };
}
