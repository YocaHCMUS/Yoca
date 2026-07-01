/**
 * News types for token-overview News tab
 */

export interface NewsTokenContext {
    labels: string[];
    priceSeries: Array<number | null>;
    marketCapSeries: Array<number | null>;
}

export interface NewsArticleExpansion {
    article: NewsArticle;
    token: {
        address: string;
        symbol: string;
        name: string;
    };
    extraSnippets: string[];
    context: NewsTokenContext | null;
}

export interface NewsArticle {
    id?: number;
    batchId?: number;
    title: string;
    url: string;
    source?: string;
    description?: string | null;
    publishedAt?: string | null;
    sourceName?: string | null;
    faviconUrl?: string | null;
    imageUrl?: string | null;
    favicon?: string | null;
    contentHash?: string;
    extraSnippets?: string[] | null;
    context?: NewsTokenContext | null;
    score?: number;
    matchedBy?: string[];
    sourceType?: 'news' | 'web_mention' | 'project_update';
    raw?: Record<string, unknown>;
}

export interface TokenNewsArticle {
    title: string;
    url: string;
    source: string;
    publishedAt: string | null;
    description: string;
    score: number;
    matchedBy: string[];
    sourceType: 'news' | 'web_mention' | 'project_update';
    imageUrl?: string | null;
    favicon?: string | null;
}

export interface TokenNewsResponseData {
    token: {
        address: string;
        symbol: string;
        name: string;
    };
    source: 'rss' | 'rss+brave';
    updatedAt: string;
    providersUsed?: Array<'rss' | 'brave'>;
    braveFallbackUsed?: boolean;
    braveNewsUsed?: boolean;
    braveWebFallbackUsed?: boolean;
    sourceTypeCounts?: {
        news: number;
        web_mention: number;
        project_update: number;
    };
    articles: TokenNewsArticle[];
    meta?: {
        rssArticles: number;
        braveArticles: number;
        webMentionArticles?: number;
        fallbackUsed: boolean;
        braveFallbackUsed?: boolean;
        braveNewsUsed?: boolean;
        braveWebFallbackUsed?: boolean;
        providersUsed?: Array<'rss' | 'brave'>;
        sourceTypeCounts?: {
            news: number;
            web_mention: number;
            project_update: number;
        };
    };
}

export interface TokenNewsApiResponse {
    success: boolean;
    data: TokenNewsResponseData;
}

export interface NewsFilterResult {
    source: 'rss' | 'rss+brave';
    updatedAt: string;
    entries: NewsArticle[];
}

export interface NewsArticleExpansionResult {
    status?: string;
    article: NewsArticle;
    token: {
        address: string;
        symbol: string;
        name: string;
    };
    extraSnippets: string[];
    context: NewsTokenContext | null;
}

export interface TokenNewsQuery {
    address: string;
    symbol: string;
    name: string;
    limit?: number;
    offset?: number;
}

export interface NewsPaginationParams {
    limit: number;
    offset: number;
}
