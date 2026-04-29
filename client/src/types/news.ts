/**
 * News types for token-overview News tab
 */

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
    raw?: Record<string, unknown>;
}

export interface NewsFilterResult {
    cached: boolean;
    entries: NewsArticle[];
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
