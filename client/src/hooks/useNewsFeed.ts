/**
 * useNewsFeed Hook
 * Manages news fetching with user-initiated loading, caching, and loading states
 */

import { useCallback, useState } from 'react';
import { getNewsForToken } from '@/services/news';
import type { NewsArticle, TokenNewsQuery } from '@/types/news';

interface UseNewsFeedState {
    entries: NewsArticle[];
    isLoading: boolean;
    error: string | null;
    cached: boolean;
    hasLoaded: boolean;
}

export function useNewsFeed(query: TokenNewsQuery) {
    const [state, setState] = useState<UseNewsFeedState>({
        entries: [],
        isLoading: false,
        error: null,
        cached: false,
        hasLoaded: false,
    });

    const fetchNews = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));

        try {
            const result = await getNewsForToken(query);
            setState({
                entries: result.entries || [],
                isLoading: false,
                error: null,
                cached: result.cached,
                hasLoaded: true,
            });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : 'Failed to fetch news';
            setState((prev) => ({
                ...prev,
                isLoading: false,
                error: message,
                hasLoaded: true,
            }));
        }
    }, [query]);

    const refresh = useCallback(() => {
        fetchNews();
    }, [fetchNews]);

    return {
        ...state,
        fetchNews,
        refresh,
    };
}
