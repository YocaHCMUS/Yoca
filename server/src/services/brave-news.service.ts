import type { RawNewsArticle, TokenNewsIdentity } from "./rss-news.service.js";

interface BraveNewsSearchOptions {
  identity: TokenNewsIdentity;
  isSolanaEcosystem: boolean;
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
const BRAVE_RESULT_COUNT = 20;

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

export function buildBraveNewsQuery({
  identity,
  isSolanaEcosystem,
}: BraveNewsSearchOptions) {
  const searchName = getPrimarySearchName(identity);
  const searchSymbol =
    identity.searchSymbols[0] ?? identity.normalizedSymbol ?? "";

  if (isSolanaEcosystem && searchSymbol !== "SOL") {
    return `"${searchName}" "$${searchSymbol}" Solana news`;
  }

  if (isSolanaEcosystem) {
    return `${searchName} ${searchSymbol} latest news`;
  }

  return `"${searchName}" "$${searchSymbol}" crypto news`;
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
  const query = buildBraveNewsQuery(options);
  let endpointUsed = BRAVE_NEWS_SEARCH_ENDPOINT;

  try {
    const payload = await fetchBraveEndpoint(BRAVE_NEWS_SEARCH_ENDPOINT, query);
    const results = payload.results ?? [];

    return {
      query,
      endpointUsed,
      rawResultCount: results.length,
      articles: results
        .map(normalizeBraveItem)
        .filter((article): article is RawNewsArticle => article != null),
    };
  } catch (err) {
    endpointUsed = BRAVE_WEB_SEARCH_ENDPOINT;
    console.warn("[brave-news] news search failed, trying web search", {
      query,
      error: err instanceof Error ? err.message : String(err),
    });

    const payload = await fetchBraveEndpoint(BRAVE_WEB_SEARCH_ENDPOINT, query);
    const results = payload.web?.results ?? [];

    return {
      query,
      endpointUsed,
      rawResultCount: results.length,
      articles: results
        .map(normalizeBraveItem)
        .filter((article): article is RawNewsArticle => article != null),
    };
  }
}
