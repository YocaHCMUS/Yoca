/**
 * News API Service
 * Provides functions to fetch news for a specific token from the backend.
 * The backend handles n8n integration, caching, and article storage.
 */

import client from '@/api/main';
import type { NewsFilterResult, TokenNewsQuery } from '@/types/news';

/**
 * Fetch filtered news for a token.
 * Calls POST /api/news/webhook which:
 * - Checks cache in DB
 * - Fetches from n8n if stale/missing
 * - Stores results
 * - Returns entries
 */
export async function getNewsForToken(query: TokenNewsQuery): Promise<NewsFilterResult> {
    try {
        const resp = await client.api.news.webhook.$post({
            json: {
                address: query.address,
                symbol: query.symbol,
                name: query.name,
            },
        });

        if (!resp.ok) {
            console.error('[news service] failed to fetch news:', resp.status);
            return { cached: false, entries: [] };
        }

        const data = (await resp.json()) as any;
        return {
            cached: data.cached ?? false,
            entries: data.entries ?? [],
        };
    } catch (err) {
        console.error('[news service] error fetching news:', err);
        return { cached: false, entries: [] };
    }
}
