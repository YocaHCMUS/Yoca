import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NewsCard } from './NewsCard';
import type { NewsArticle, NewsArticleExpansion } from '@/types/news';

vi.mock('@/contexts/LocalizationContext', () => ({
    useLocalization: () => ({
        tr: (key: string, params?: Record<string, string>) => {
            if (key === 'token.news.tokenContextLabel' && params?.symbol) {
                return `Context for ${params.symbol}`;
            }
            return key;
        },
        fmt: {
            datetime: {
                datetime: (date: Date) => date.toISOString(),
            },
        },
    }),
}));

describe('NewsCard', () => {
    const article: NewsArticle = {
        title: 'Token jumps on breakout',
        url: 'https://example.com/article',
        description: 'Short summary',
        publishedAt: '2026-05-01T10:00:00.000Z',
        sourceName: 'Example News',
        faviconUrl: null,
        contentHash: 'abc123abc123abc123abc123abc123abc123abc123abc123abc123abc123abcd',
    };

    const expansion: NewsArticleExpansion = {
        article,
        token: {
            address: 'Token1111111111111111111111111111111111111',
            symbol: 'TKN',
            name: 'Token',
        },
        extraSnippets: ['Snippet one', 'Snippet two'],
        context: {
            labels: ['2026-04-29', '2026-04-30', '2026-05-01'],
            priceSeries: [1, 2, 3],
            marketCapSeries: [10, 20, 30],
        },
    };

    it('renders expand control and notifies parent', () => {
        const onToggleExpand = vi.fn();

        render(
            <NewsCard
                article={article}
                isExpanded={false}
                isLoadingExpansion={false}
                expansion={null}
                onToggleExpand={onToggleExpand}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'token.news.expand' }));

        expect(onToggleExpand).toHaveBeenCalledWith(article);
    });

    it('shows snippets and charts when expanded', () => {
        const onToggleExpand = vi.fn();

        render(
            <NewsCard
                article={article}
                isExpanded
                isLoadingExpansion={false}
                expansion={expansion}
                onToggleExpand={onToggleExpand}
            />,
        );

        expect(screen.getByText('token.news.snippetsTitle')).toBeInTheDocument();
        expect(screen.getByText('Snippet one')).toBeInTheDocument();
        expect(screen.getByText('Snippet two')).toBeInTheDocument();
        expect(screen.getByText('token.news.contextTitle')).toBeInTheDocument();
        expect(screen.getByText('Context for TKN')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'token.news.collapse' })).toBeInTheDocument();
    });
});