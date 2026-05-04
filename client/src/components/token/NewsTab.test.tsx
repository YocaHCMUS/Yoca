import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsTab } from './NewsTab';
import type { NewsArticleExpansion } from '@/types/news';

const newsFeedState = {
    entries: [] as Array<{
        title: string;
        url: string;
        description?: string | null;
        publishedAt?: string | null;
        sourceName?: string | null;
        contentHash?: string;
    }>,
    isLoading: false,
    error: null as string | null,
    cached: false,
    hasLoaded: true,
    fetchNews: vi.fn(),
    refresh: vi.fn(),
};

const expansionByHash: Record<string, NewsArticleExpansion> = {
    'hash-1': {
        article: {
            title: 'Article 1',
            url: 'https://example.com/1',
            contentHash: 'hash-1',
            publishedAt: '2026-05-01T00:00:00.000Z',
        },
        token: { address: 'Token1111111111111111111111111111111111111', symbol: 'AAA', name: 'AAA' },
        extraSnippets: ['Snippet 1'],
        context: { labels: ['2026-04-29'], priceSeries: [1], marketCapSeries: [10] },
    },
    'hash-2': {
        article: {
            title: 'Article 2',
            url: 'https://example.com/2',
            contentHash: 'hash-2',
            publishedAt: '2026-05-02T00:00:00.000Z',
        },
        token: { address: 'Token2222222222222222222222222222222222222', symbol: 'BBB', name: 'BBB' },
        extraSnippets: ['Snippet 2'],
        context: { labels: ['2026-04-30'], priceSeries: [2], marketCapSeries: [20] },
    },
};

vi.mock('@/contexts/LocalizationContext', () => ({
    useLocalization: () => ({
        tr: (key: string, params?: Record<string, string>) => {
            if (key === 'token.news.empty' && params?.name) return `No news for ${params.name}`;
            if (key === 'token.news.tokenContextLabel' && params?.symbol) return `Context for ${params.symbol}`;
            return key;
        },
        fmt: {
            datetime: {
                datetime: (date: Date) => date.toISOString(),
            },
        },
    }),
}));

vi.mock('@/hooks/useNewsFeed', () => ({
    useNewsFeed: () => newsFeedState,
}));

vi.mock('@/services/news', () => ({
    getExpandedNewsArticle: vi.fn(async (contentHash: string) => expansionByHash[contentHash] ?? null),
}));

describe('NewsTab', () => {
    beforeEach(() => {
        newsFeedState.entries = [
            {
                title: 'Article 1',
                url: 'https://example.com/1',
                description: 'Summary 1',
                publishedAt: '2026-05-01T00:00:00.000Z',
                sourceName: 'Source 1',
                contentHash: 'hash-1',
            },
            {
                title: 'Article 2',
                url: 'https://example.com/2',
                description: 'Summary 2',
                publishedAt: '2026-05-02T00:00:00.000Z',
                sourceName: 'Source 2',
                contentHash: 'hash-2',
            },
        ];
        newsFeedState.isLoading = false;
        newsFeedState.error = null;
        newsFeedState.cached = false;
        newsFeedState.hasLoaded = true;
        newsFeedState.fetchNews.mockClear();
        newsFeedState.refresh.mockClear();
    });

    it('keeps only one expanded card open', async () => {
        render(<NewsTab address="Token1111111111111111111111111111111111111" symbol="AAA" name="Token AAA" />);

        fireEvent.click(screen.getAllByRole('button', { name: 'token.news.expand' })[0]);
        await waitFor(() => expect(screen.getByText('Snippet 1')).toBeInTheDocument());

        fireEvent.click(screen.getByRole('button', { name: 'token.news.expand' }));
        await waitFor(() => expect(screen.getByText('Snippet 2')).toBeInTheDocument());

        expect(screen.queryByText('Snippet 1')).not.toBeInTheDocument();
    });

    it('renders loading skeleton before first fetch', () => {
        newsFeedState.entries = [];
        newsFeedState.isLoading = true;
        newsFeedState.hasLoaded = false;

        const { container } = render(<NewsTab address="Token1111111111111111111111111111111111111" symbol="AAA" name="Token AAA" />);

        expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    });
});