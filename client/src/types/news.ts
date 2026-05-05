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
    description?: string | null;
    publishedAt?: string | null;
    sourceName?: string | null;
    faviconUrl?: string | null;
    contentHash?: string;
    extraSnippets?: string[] | null;
    context?: NewsTokenContext | null;
    raw?: Record<string, unknown>;
}

export interface NewsFilterResult {
    cached: boolean;
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
