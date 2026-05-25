import Parser from "rss-parser";
import { fetchBraveTokenNews } from "./brave-news.service.js";

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

export interface TokenNewsIdentity {
  address: string;
  originalName: string;
  originalSymbol: string;
  normalizedSymbol: string;
  searchNames: string[];
  searchSymbols: string[];
}

interface RssFeedConfig {
  source: string;
  url: string;
  category: "general" | "bitcoin" | "solana" | "exchange" | "defi";
}

interface RssItem extends Parser.Item {
  contentEncoded?: string;
  description?: string;
}

export interface RawNewsArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  description: string;
  content: string;
}

interface WrappedTokenAlias {
  names: string[];
  symbols: string[];
  searchNames: string[];
  searchSymbols: string[];
}

const RSS_FEEDS: RssFeedConfig[] = [
  {
    source: "Cointelegraph",
    url: "https://cointelegraph.com/rss",
    category: "general",
  },
  { source: "Decrypt", url: "https://decrypt.co/feed", category: "general" },
  {
    source: "CryptoSlate",
    url: "https://cryptoslate.com/feed/",
    category: "general",
  },
  {
    source: "CoinDesk",
    url: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "general",
  },
  {
    source: "BeInCrypto",
    url: "https://beincrypto.com/feed/",
    category: "general",
  },
  {
    source: "CryptoBriefing",
    url: "https://cryptobriefing.com/feed/",
    category: "general",
  },
  {
    source: "Blockworks",
    url: "https://blockworks.co/feed",
    category: "general",
  },
  {
    source: "Bitcoin Magazine",
    url: "https://bitcoinmagazine.com/.rss/full/",
    category: "bitcoin",
  },
  {
    source: "Solana Blog",
    url: "https://solana.com/news/rss.xml",
    category: "solana",
  },
  {
    source: "Binance Announcements",
    url: "https://www.binance.com/en/support/announcement/rss",
    category: "exchange",
  },
  {
    source: "Coinbase Blog",
    url: "https://www.coinbase.com/blog/rss",
    category: "exchange",
  },
];

const RSS_FETCH_TIMEOUT_MS = 12_000;
const MIN_RELEVANCE_SCORE = 4;
const MIN_ARTICLES_BEFORE_SEARCH_FALLBACK = 3;

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

const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
const SOLANA_ECOSYSTEM_SYMBOLS = new Set([
  "SOL",
  "JUP",
  "PYTH",
  "BONK",
  "WIF",
  "RAY",
  "JTO",
  "ORCA",
  "HNT",
]);

const WRAPPED_TOKEN_ALIASES: WrappedTokenAlias[] = [
  {
    names: ["wrapped bitcoin", "wrapped btc", "wbtc", "sobtc"],
    symbols: ["WBTC", "SOBTC"],
    searchNames: ["Wrapped Bitcoin", "Bitcoin"],
    searchSymbols: ["BTC"],
  },
  {
    names: ["wrapped ethereum", "wrapped eth", "weth"],
    symbols: ["WETH"],
    searchNames: ["Wrapped Ethereum", "Ethereum"],
    searchSymbols: ["ETH"],
  },
  {
    names: ["wrapped sol", "wrapped solana", "wsol", "solana"],
    symbols: ["WSOL", "SOL"],
    searchNames: ["Wrapped SOL", "Solana"],
    searchSymbols: ["SOL"],
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function normalizeSymbol(value: string) {
  return value.trim().replace(/^\$/, "").toUpperCase();
}

export function buildTokenNewsIdentity(
  token: TokenNewsRequest,
): TokenNewsIdentity {
  const originalName = token.name.trim();
  const originalSymbol = token.symbol.trim();
  const normalizedSymbol = normalizeSymbol(originalSymbol);
  const lowerName = originalName.toLowerCase();
  const upperSymbol = normalizedSymbol.toUpperCase();

  const aliases = WRAPPED_TOKEN_ALIASES.find((alias) => {
    if (
      token.address === WRAPPED_SOL_MINT &&
      alias.searchSymbols.includes("SOL")
    ) {
      return true;
    }

    return (
      alias.names.some((name) => lowerName === name) ||
      alias.names.some((name) => lowerName.includes(name)) ||
      alias.symbols.includes(upperSymbol)
    );
  });

  return {
    address: token.address,
    originalName,
    originalSymbol,
    normalizedSymbol,
    searchNames: uniqueNonEmpty([
      originalName,
      ...(aliases?.searchNames ?? []),
    ]),
    searchSymbols: uniqueNonEmpty([
      normalizedSymbol,
      ...(aliases?.searchSymbols ?? []),
    ]).map(normalizeSymbol),
  };
}

function isBitcoinIdentity(identity: TokenNewsIdentity) {
  return (
    identity.searchSymbols.includes("BTC") ||
    identity.searchNames.some((name) => name.toLowerCase().includes("bitcoin"))
  );
}

export function isSolanaEcosystemIdentity(identity: TokenNewsIdentity) {
  return (
    identity.address === WRAPPED_SOL_MINT ||
    identity.searchSymbols.some((symbol) => SOLANA_ECOSYSTEM_SYMBOLS.has(symbol)) ||
    identity.searchNames.some((name) => name.toLowerCase().includes("solana"))
  );
}

function selectFeedsForToken(identity: TokenNewsIdentity) {
  const includeBitcoinFeeds = isBitcoinIdentity(identity);
  const includeSolanaFeeds = isSolanaEcosystemIdentity(identity);

  return RSS_FEEDS.filter((feed) => {
    if (feed.category === "bitcoin") return includeBitcoinFeeds;
    if (feed.category === "solana") return includeSolanaFeeds;
    return true;
  });
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

function scoreArticle(article: RawNewsArticle, identity: TokenNewsIdentity) {
  let score = 0;
  const matchedBy: string[] = [];
  let strongTitleMatch = false;
  let strongDescriptionMatch = false;
  let weakBodyMatch = false;

  const title = article.title.toLowerCase();
  const description = article.description.toLowerCase();
  const content = article.content.toLowerCase();
  const titleUpper = article.title.toUpperCase();
  const descriptionUpper = article.description.toUpperCase();
  const contentUpper = article.content.toUpperCase();

  for (const searchName of identity.searchNames) {
    const normalizedName = searchName.trim().toLowerCase();
    if (!normalizedName) continue;

    if (hasPhrase(title, normalizedName)) {
      score += 5;
      strongTitleMatch = true;
      matchedBy.push(`name-title:${searchName}`);
    }

    if (hasPhrase(description, normalizedName)) {
      score += 4;
      strongDescriptionMatch = true;
      matchedBy.push(`name-description:${searchName}`);
    }

    if (hasPhrase(content, normalizedName)) {
      weakBodyMatch = true;
    }
  }

  for (const symbol of identity.searchSymbols) {
    const cashtag = `$${symbol}`;
    if (titleUpper.includes(cashtag)) {
      score += 5;
      strongTitleMatch = true;
      matchedBy.push(`cashtag-title:${cashtag}`);
    }

    if (descriptionUpper.includes(cashtag)) {
      score += 4;
      strongDescriptionMatch = true;
      matchedBy.push(`cashtag-description:${cashtag}`);
    }

    if (contentUpper.includes(cashtag)) {
      weakBodyMatch = true;
    }

    const symbolRegex = getSymbolRegex(symbol);
    if (symbolRegex?.test(titleUpper)) {
      score += 1;
      matchedBy.push(`symbol-title:${symbol}`);
    }

    if (symbolRegex?.test(descriptionUpper)) {
      score += 1;
      matchedBy.push(`symbol-description:${symbol}`);
    }

    if (symbolRegex?.test(contentUpper)) {
      weakBodyMatch = true;
    }
  }

  const hasStrongMatch = strongTitleMatch || strongDescriptionMatch;
  const visibleText = `${title} ${description}`;

  if (hasStrongMatch) {
    for (const keyword of EVENT_KEYWORDS) {
      if (visibleText.includes(keyword)) {
        score += 1;
        matchedBy.push(`event:${keyword}`);
        break;
      }
    }
  }

  for (const phrase of WEAK_GENERIC_PHRASES) {
    if (visibleText.includes(phrase)) {
      score -= 3;
      matchedBy.push(`weak:${phrase}`);
      break;
    }
  }

  return {
    score,
    matchedBy: [...new Set(matchedBy)],
    hasStrongMatch,
    strongTitleMatch,
    strongDescriptionMatch,
    weakBodyMatch,
  };
}

function getContentOnlyMatches(
  article: RawNewsArticle,
  identity: TokenNewsIdentity,
) {
  const visibleText = `${article.title} ${article.description}`.toLowerCase();
  const visibleTextUpper = `${article.title} ${article.description}`.toUpperCase();
  const content = article.content.toLowerCase();
  const contentUpper = article.content.toUpperCase();
  const matches: string[] = [];

  for (const searchName of identity.searchNames) {
    const normalizedName = searchName.trim().toLowerCase();
    if (!normalizedName) continue;

    if (
      hasPhrase(content, normalizedName) &&
      !hasPhrase(visibleText, normalizedName)
    ) {
      matches.push(`name:${searchName}`);
    }
  }

  for (const symbol of identity.searchSymbols) {
    const cashtag = `$${symbol}`;
    if (
      contentUpper.includes(cashtag) &&
      !visibleTextUpper.includes(cashtag)
    ) {
      matches.push(`cashtag:${cashtag}`);
    }

    const symbolRegex = getSymbolRegex(symbol);
    if (
      symbolRegex?.test(contentUpper) &&
      !symbolRegex.test(visibleTextUpper)
    ) {
      matches.push(`symbol:${symbol}`);
    }
  }

  return [...new Set(matches)];
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

function scoreAndFilterArticles(
  articles: RawNewsArticle[],
  identity: TokenNewsIdentity,
) {
  const scoredArticles = articles.map((article) => {
    const relevance = scoreArticle(article, identity);
    return {
      article,
      relevance,
      contentOnlyMatches: getContentOnlyMatches(article, identity),
    };
  });

  const matchedArticles = scoredArticles
    .filter(
      ({ relevance }) =>
        relevance.hasStrongMatch && relevance.score >= MIN_RELEVANCE_SCORE,
    )
    .map(({ article, relevance }) => ({
      title: article.title,
      url: article.url,
      source: article.source,
      publishedAt: article.publishedAt,
      description: article.description,
      score: relevance.score,
      matchedBy: relevance.matchedBy,
    }));

  return { scoredArticles, matchedArticles };
}

function logContentOnlyRejectedSample(
  scoredArticles: ReturnType<typeof scoreAndFilterArticles>["scoredArticles"],
  identity: TokenNewsIdentity,
  source: string,
) {
  const contentOnlyRejectedSample = scoredArticles
    .filter(
      ({ relevance, contentOnlyMatches }) =>
        !relevance.hasStrongMatch && contentOnlyMatches.length > 0,
    )
    .slice(0, 3)
    .map(({ article, relevance, contentOnlyMatches }) => ({
      title: article.title,
      source: article.source,
      score: relevance.score,
      matchedContentOnly: contentOnlyMatches,
    }));

  if (contentOnlyRejectedSample.length > 0) {
    console.debug(
      "[rss-news] rejected content-only mentions",
      JSON.stringify(
        {
          token: identity.normalizedSymbol,
          source,
          sample: contentOnlyRejectedSample,
        },
        null,
        2,
      ),
    );
  }
}

export async function getRssTokenNews(token: TokenNewsRequest) {
  const identity = buildTokenNewsIdentity(token);
  const selectedFeeds = selectFeedsForToken(identity);

  console.info("[rss-news] token news identity", {
    originalName: identity.originalName,
    originalSymbol: identity.originalSymbol,
    normalizedSymbol: identity.normalizedSymbol,
    searchNames: identity.searchNames,
    searchSymbols: identity.searchSymbols,
  });

  console.info("[rss-news] selected feeds", {
    selectedFeeds: selectedFeeds.length,
    selectedFeedSources: selectedFeeds.map((feed) => feed.source),
  });

  const settled = await Promise.all(
    selectedFeeds.map(async (feed) => {
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

  const {
    scoredArticles: scoredRssArticles,
    matchedArticles: matchedRssArticles,
  } = scoreAndFilterArticles(fetchedArticles, identity);
  logContentOnlyRejectedSample(scoredRssArticles, identity, "rss");

  const rssArticles = dedupeArticles(matchedRssArticles);
  let braveArticles: TokenNewsArticle[] = [];
  let fallbackUsed = false;

  if (
    rssArticles.length < MIN_ARTICLES_BEFORE_SEARCH_FALLBACK &&
    process.env.BRAVE_SEARCH_API_KEY?.trim()
  ) {
    fallbackUsed = true;
    try {
      const braveResult = await fetchBraveTokenNews({
        identity,
        isSolanaEcosystem: isSolanaEcosystemIdentity(identity),
      });
      const { scoredArticles, matchedArticles } = scoreAndFilterArticles(
        braveResult.articles,
        identity,
      );
      braveArticles = dedupeArticles(matchedArticles);

      console.info("[rss-news] brave fallback", {
        used: true,
        query: braveResult.query,
        endpointUsed: braveResult.endpointUsed,
        rawResults: braveResult.rawResultCount,
        normalizedResults: braveResult.articles.length,
        matchedResults: braveArticles.length,
      });
      logContentOnlyRejectedSample(scoredArticles, identity, "brave");
    } catch (err) {
      console.warn("[rss-news] brave fallback failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  } else {
    console.info("[rss-news] brave fallback", {
      used: false,
      reason:
        rssArticles.length >= MIN_ARTICLES_BEFORE_SEARCH_FALLBACK
          ? "rss-threshold-met"
          : "missing-api-key",
      rssArticles: rssArticles.length,
    });
  }

  const articles = dedupeArticles([...rssArticles, ...braveArticles]).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (
      (b.publishedAt ? Date.parse(b.publishedAt) : 0) -
      (a.publishedAt ? Date.parse(a.publishedAt) : 0)
    );
  });

  console.info("[rss-news] token news fetch", {
    selectedFeeds: selectedFeeds.length,
    selectedFeedSources: selectedFeeds.map((feed) => feed.source),
    articlesFetched: fetchedArticles.length,
    articlesMatched: articles.length,
    rssArticles: rssArticles.length,
    braveArticles: braveArticles.length,
    fallbackUsed,
    failedFeeds: failedFeeds.map((feed) => feed.source),
  });

  if (failedFeeds.length > 0) {
    console.warn("[rss-news] failed feeds", failedFeeds);
  }

  return {
    token: {
      address: identity.address,
      symbol: identity.normalizedSymbol,
      name: identity.originalName,
    },
    source: fallbackUsed ? ("rss+brave" as const) : ("rss" as const),
    updatedAt: new Date().toISOString(),
    articles,
    meta: {
      rssArticles: rssArticles.length,
      braveArticles: braveArticles.length,
      fallbackUsed,
    },
  };
}
