import Parser from "rss-parser";

export interface TokenNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  score: number;
  matchedBy: string[];
}

export interface TokenNewsRequest {
  address: string;
  symbol: string;
  name: string;
}

interface RssFeedConfig {
  source: string;
  url: string;
}

interface RssItem extends Parser.Item {
  contentEncoded?: string;
  description?: string;
}

interface RawNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  content: string;
}

const RSS_FEEDS: RssFeedConfig[] = [
  { source: "Cointelegraph", url: "https://cointelegraph.com/rss" },
  { source: "Decrypt", url: "https://decrypt.co/feed" },
  { source: "CryptoSlate", url: "https://cryptoslate.com/feed/" },
  {
    source: "Bitcoin Magazine",
    url: "https://bitcoinmagazine.com/.rss/full/",
  },
  {
    source: "Binance Announcements",
    url: "https://www.binance.com/en/support/announcement/rss",
  },
  { source: "Coinbase Blog", url: "https://www.coinbase.com/blog/rss" },
];

const RSS_FETCH_TIMEOUT_MS = 12_000;

const parser = new Parser<unknown, RssItem>({
  timeout: 12_000,
  customFields: {
    item: [["content:encoded", "contentEncoded"], "description"] as never,
  },
});

const EVENT_KEYWORDS = [
  "listing",
  "launch",
  "integration",
  "partnership",
  "upgrade",
  "governance",
  "exploit",
  "hack",
  "funding",
  "airdrop",
  "mainnet",
  "roadmap",
  "token unlock",
];

const WEAK_GENERIC_PHRASES = [
  "price prediction",
  "top gainers",
  "market today",
  "could rally",
  "analyst says",
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function parsePublishedAt(item: RssItem) {
  const value = item.isoDate ?? item.pubDate;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function hasPhrase(text: string, phrase: string) {
  const normalizedPhrase = phrase.trim();
  if (!normalizedPhrase) return false;

  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedPhrase.toLowerCase())}([^a-z0-9]|$)`,
    "i",
  );
  return pattern.test(text);
}

function getSymbolRegex(symbol: string) {
  const normalized = symbol.trim().replace(/^\$/, "").toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(normalized)) return null;

  return new RegExp(`(^|[^A-Z0-9])${escapeRegExp(normalized)}([^A-Z0-9]|$)`);
}

function scoreArticle(article: RawNewsArticle, token: TokenNewsRequest) {
  let score = 0;
  const matchedBy: string[] = [];

  const tokenName = token.name.trim().toLowerCase();
  const symbol = token.symbol.trim().replace(/^\$/, "").toUpperCase();
  const title = article.title.toLowerCase();
  const body = `${article.description} ${article.content}`.toLowerCase();
  const titleUpper = article.title.toUpperCase();
  const bodyUpper = `${article.description} ${article.content}`.toUpperCase();

  if (tokenName && hasPhrase(title, tokenName)) {
    score += 4;
    matchedBy.push("title:name");
  }

  if (tokenName && hasPhrase(body, tokenName)) {
    score += 3;
    matchedBy.push("description:name");
  }

  if (symbol) {
    const cashtag = `$${symbol}`;
    if (titleUpper.includes(cashtag)) {
      score += 4;
      matchedBy.push("title:$symbol");
    }

    if (bodyUpper.includes(cashtag)) {
      score += 3;
      matchedBy.push("description:$symbol");
    }

    const symbolRegex = getSymbolRegex(symbol);
    if (symbolRegex?.test(titleUpper)) {
      score += 1;
      matchedBy.push("title:symbol");
    }

    if (symbolRegex?.test(bodyUpper)) {
      score += 1;
      matchedBy.push("description:symbol");
    }
  }

  const combinedText = `${title} ${body}`;
  for (const keyword of EVENT_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      score += 1;
      matchedBy.push(`event:${keyword}`);
      break;
    }
  }

  for (const phrase of WEAK_GENERIC_PHRASES) {
    if (combinedText.includes(phrase)) {
      score -= 2;
      matchedBy.push(`weak:${phrase}`);
      break;
    }
  }

  return { score, matchedBy };
}

async function fetchFeed(feed: RssFeedConfig) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RSS_FETCH_TIMEOUT_MS);

  let xml = "";
  try {
    const response = await fetch(feed.url, {
      headers: {
        "User-Agent": "Yoca RSS News Fetcher/1.0",
        Accept:
          "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`RSS feed responded ${response.status}`);
    }

    xml = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  if (!xml.trim()) {
    throw new Error("RSS feed returned an empty response");
  }

  const parsed = await parser.parseString(xml);
  if (parsed.items.length === 0) {
    throw new Error("RSS feed returned no items");
  }

  const articles = parsed.items
    .map((item): RawNewsArticle | null => {
      const title = stripHtml(item.title ?? "");
      const url = item.link?.trim() ?? item.guid?.trim() ?? "";
      if (!title || !url) return null;

      const description = stripHtml(
        item.contentSnippet ?? item.description ?? item.summary ?? "",
      );
      const content = stripHtml(item.contentEncoded ?? item.content ?? "");

      return {
        title,
        url,
        source: feed.source,
        publishedAt: parsePublishedAt(item),
        description,
        content,
      };
    })
    .filter((article): article is RawNewsArticle => article != null);

  if (articles.length === 0) {
    throw new Error(`RSS feed returned ${parsed.items.length} unusable items`);
  }

  return articles;
}

function dedupeArticles(articles: TokenNewsArticle[]) {
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

export async function getRssTokenNews(token: TokenNewsRequest) {
  const settled = await Promise.all(
    RSS_FEEDS.map(async (feed) => {
      try {
        return {
          feed,
          articles: await fetchFeed(feed),
          error: null as string | null,
        };
      } catch (err) {
        return {
          feed,
          articles: [] as RawNewsArticle[],
          error:
            err instanceof Error
              ? err.message || err.name || "Unknown RSS fetch error"
              : String(err),
        };
      }
    }),
  );

  const failedFeeds: Array<{ source: string; url: string; error: string }> = [];
  const fetchedArticles: RawNewsArticle[] = [];

  for (const result of settled) {
    if (result.error == null) {
      fetchedArticles.push(...result.articles);
      continue;
    }

    failedFeeds.push({
      source: result.feed.source,
      url: result.feed.url,
      error: result.error,
    });
  }

  const matchedArticles = fetchedArticles
    .map((article) => {
      const { score, matchedBy } = scoreArticle(article, token);
      return {
        title: article.title,
        url: article.url,
        source: article.source,
        publishedAt: article.publishedAt,
        description: article.description,
        score,
        matchedBy,
      };
    })
    .filter((article) => article.score >= 3);

  const articles = dedupeArticles(matchedArticles).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      (b.publishedAt ? Date.parse(b.publishedAt) : 0) -
      (a.publishedAt ? Date.parse(a.publishedAt) : 0)
    );
  });

  console.info("[rss-news] token news fetch", {
    feedsAttempted: RSS_FEEDS.length,
    articlesFetched: fetchedArticles.length,
    articlesMatched: articles.length,
    failedFeeds: failedFeeds.map((feed) => feed.source),
  });

  if (failedFeeds.length > 0) {
    console.warn("[rss-news] failed feeds", failedFeeds);
  }

  return {
    token,
    source: "rss" as const,
    updatedAt: new Date().toISOString(),
    articles,
  };
}
