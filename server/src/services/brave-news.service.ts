import type { RawNewsArticle, TokenNewsIdentity } from "./rss-news.service.js";

interface BraveNewsSearchOptions {
  identity: TokenNewsIdentity;
  isSolanaEcosystem: boolean;
  eventAt?: string;
  searchMode?: "token" | "event" | "chart";
}

interface BraveSearchItem {
  title?: string;
  url?: string;
  description?: string;
  age?: string;
  page_age?: string;
  page_fetched?: string;
  profile?: {
    name?: string;
  };
  meta_url?: {
    hostname?: string;
  };
}

const BRAVE_NEWS_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/news/search";
const BRAVE_WEB_SEARCH_ENDPOINT =
  "https://api.search.brave.com/res/v1/web/search";
const BRAVE_SEARCH_TIMEOUT_MS = 10_000;
const BRAVE_RESULT_COUNT = 10;
const MAX_BRAVE_QUERIES = 3;

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function getHostname(value: string) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "Brave Search";
  }
}

function parsePublishedAt(item: BraveSearchItem) {
  const value = item.page_age ?? item.page_fetched;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function getPrimarySearchName(identity: TokenNewsIdentity) {
  const nonWrappedName = identity.searchNames.find(
    (name) => !name.toLowerCase().startsWith("wrapped "),
  );

  return nonWrappedName ?? identity.searchNames[0] ?? identity.originalName;
}

function formatEventDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date
    .toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(",", "");
}

function formatEventMonthYear(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function uniqueNonEmpty(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

export function buildBraveNewsQueries({
  identity,
  isSolanaEcosystem,
  eventAt,
  searchMode = eventAt ? "event" : "token",
}: BraveNewsSearchOptions) {
  const searchName = getPrimarySearchName(identity);
  const searchSymbol =
    identity.searchSymbols[0] ?? identity.normalizedSymbol ?? "";
  const quotedName = `"${searchName}"`;
  const quotedSymbol = searchSymbol ? `"${searchSymbol}"` : "";

  if (searchMode === "event" || searchMode === "chart") {
    const eventDate = formatEventDate(eventAt);
    const monthYear = formatEventMonthYear(eventAt);

    return uniqueNonEmpty([
      `${quotedName} ${quotedSymbol} crypto news ${eventDate}`,
      `${quotedName} ${quotedSymbol} update ${monthYear}`,
      isSolanaEcosystem
        ? `${quotedName} ${quotedSymbol} Solana news ${monthYear}`
        : "",
    ]).slice(0, MAX_BRAVE_QUERIES);
  }

  return uniqueNonEmpty([
    `${quotedName} ${quotedSymbol} crypto news`,
    isSolanaEcosystem ? `${quotedName} ${quotedSymbol} Solana news` : "",
    `${quotedName} token latest news`,
  ]).slice(0, MAX_BRAVE_QUERIES);
}

export function buildBraveNewsQuery(options: BraveNewsSearchOptions) {
  return buildBraveNewsQueries(options)[0] ?? "";
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
  return stripHtml(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeRawArticles(articles: RawNewsArticle[]) {
  const byUrl = new Map<string, RawNewsArticle>();

  for (const article of articles) {
    const key = normalizeUrl(article.url);
    const existing = byUrl.get(key);
    if (!existing || article.description.length > existing.description.length) {
      byUrl.set(key, article);
    }
  }

  const byTitle = new Map<string, RawNewsArticle>();
  for (const article of byUrl.values()) {
    const key = normalizeTitle(article.title);
    const existing = byTitle.get(key);
    if (!existing || article.description.length > existing.description.length) {
      byTitle.set(key, article);
    }
  }

  return [...byTitle.values()];
}

function normalizeBraveItem(item: BraveSearchItem): RawNewsArticle | null {
  const title = stripHtml(item.title ?? "");
  const url = item.url?.trim() ?? "";
  if (!title || !url) return null;

  const description = stripHtml(item.description ?? "");
  const source =
    item.profile?.name?.trim() ||
    item.meta_url?.hostname?.replace(/^www\./, "") ||
    getHostname(url);

  return {
    title,
    url,
    source,
    publishedAt: parsePublishedAt(item),
    description,
    content: "",
  };
}

async function fetchBraveEndpoint(endpoint: string, query: string) {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is not set");
  }

  const url = new URL(endpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(BRAVE_RESULT_COUNT));
  url.searchParams.set("country", "US");
  url.searchParams.set("search_lang", "en");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BRAVE_SEARCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Brave responded ${response.status}`);
    }

    return (await response.json()) as {
      results?: BraveSearchItem[];
      web?: {
        results?: BraveSearchItem[];
      };
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBraveTokenNews(options: BraveNewsSearchOptions) {
  const queries = buildBraveNewsQueries(options);
  const endpointUsed = new Set<string>();
  const articles: RawNewsArticle[] = [];
  let rawResultCount = 0;

  for (const query of queries) {
    try {
      const payload = await fetchBraveEndpoint(
        BRAVE_NEWS_SEARCH_ENDPOINT,
        query,
      );
      endpointUsed.add(BRAVE_NEWS_SEARCH_ENDPOINT);
      const results = payload.results ?? [];
      rawResultCount += results.length;
      articles.push(
        ...results
          .map(normalizeBraveItem)
          .filter((article): article is RawNewsArticle => article != null),
      );
    } catch (err) {
      console.warn("[brave-news] news search failed, trying web search", {
        query,
        error: err instanceof Error ? err.message : String(err),
      });

      try {
        const payload = await fetchBraveEndpoint(
          BRAVE_WEB_SEARCH_ENDPOINT,
          query,
        );
        endpointUsed.add(BRAVE_WEB_SEARCH_ENDPOINT);
        const results = payload.web?.results ?? [];
        rawResultCount += results.length;
        articles.push(
          ...results
            .map(normalizeBraveItem)
            .filter((article): article is RawNewsArticle => article != null),
        );
      } catch (webErr) {
        console.warn("[brave-news] web search failed", {
          query,
          error: webErr instanceof Error ? webErr.message : String(webErr),
        });
      }
    }
  }

  return {
    query: queries[0] ?? "",
    queries,
    endpointUsed: [...endpointUsed].join(","),
    rawResultCount,
    articles: dedupeRawArticles(articles),
  };
}
