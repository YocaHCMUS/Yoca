/**
 * News API Service
 * Provides functions to fetch news for a specific token from the backend.
 */

import client from '@/api/main';
import type {
    NewsArticleExpansion,
    NewsArticleExpansionResult,
    NewsFilterResult,
    TokenNewsApiResponse,
    TokenNewsQuery,
} from '@/types/news';

/**
 * Fetch RSS-filtered news for a token from GET /api/token-news.
 */
export async function getTokenNews(query: TokenNewsQuery): Promise<NewsFilterResult> {
    const resp = await client.api.tokenNews.index.$get({
        query: {
            address: query.address,
            symbol: query.symbol,
            name: query.name,
        },
    });

    if (!resp.ok) {
        throw new Error(`Failed to fetch token news: ${resp.status}`);
    }

    const payload = (await resp.json()) as TokenNewsApiResponse;
    if (!payload.success) {
        throw new Error('Failed to fetch token news');
    }

    return {
        source: payload.data.source,
        updatedAt: payload.data.updatedAt,
        entries: payload.data.articles.map((article) => ({
            ...article,
            sourceName: article.source,
            faviconUrl: article.favicon ?? null,
        })),
    };
}

export async function getExpandedNewsArticle(contentHash: string): Promise<NewsArticleExpansion | null> {
    try {
        const resp = await client.api.news.articles[':contentHash'].expand.$get({
            param: {
                contentHash: encodeURIComponent(contentHash),
            }
        });

        if (!resp.ok) {
            return null;
        }

        const data = (await resp.json()) as NewsArticleExpansionResult;
        return {
            article: data.article,
            token: data.token,
            extraSnippets: data.extraSnippets ?? [],
            context: data.context ?? null,
        };
    } catch (err) {
        console.error('[news service] error fetching expanded article:', err);
        return null;
    }
}
