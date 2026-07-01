/**
 * NewsTab Component
 * Displays RSS news articles for a token with refresh and pagination.
 */

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Renew } from '@carbon/icons-react';
import { Button, SkeletonText } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { NewsCard } from './NewsCard';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import type { NewsArticle, TokenNewsQuery } from '@/types/news';
import styles from './NewsTab.module.scss';

interface NewsTabProps {
    address: string;
    symbol: string;
    name: string;
}

const NEWS_PAGE_SIZE = 10;

function getPublishedTimestamp(article: NewsArticle) {
    if (!article.publishedAt) return 0;

    const timestamp = Date.parse(article.publishedAt);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function NewsTab({ address, symbol, name }: NewsTabProps) {
    const { tr } = useLocalization();
    const query: TokenNewsQuery = { address, symbol, name };
    const news = useNewsFeed(query);
    const [currentNewsPage, setCurrentNewsPage] = useState(0);
    const [sortedArticles, setSortedArticles] = useState<NewsArticle[]>([]);

    useEffect(() => {
        const nextArticles = [...news.entries].sort(
            (a, b) => getPublishedTimestamp(b) - getPublishedTimestamp(a),
        );

        setSortedArticles(nextArticles);
        setCurrentNewsPage(0);
    }, [news.entries]);

    useEffect(() => {
        if (address && symbol && name) {
            news.fetchNews();
        }
    }, [address, symbol, name, news.fetchNews]);

    const totalPages = Math.ceil(sortedArticles.length / NEWS_PAGE_SIZE);
    const visibleArticles = sortedArticles.slice(
        currentNewsPage * NEWS_PAGE_SIZE,
        currentNewsPage * NEWS_PAGE_SIZE + NEWS_PAGE_SIZE,
    );

    const handlePreviousPage = () => {
        setCurrentNewsPage((page) => Math.max(0, page - 1));
    };

    const handleNextPage = () => {
        setCurrentNewsPage((page) => Math.min(totalPages - 1, page + 1));
    };

    const start = String(sortedArticles.length === 0 ? 0 : currentNewsPage * NEWS_PAGE_SIZE + 1);
    const end = String(Math.min(currentNewsPage * NEWS_PAGE_SIZE + NEWS_PAGE_SIZE, sortedArticles.length));
    const count = String(sortedArticles.length);
    const noMajorNewsResults = sortedArticles.length > 0
        && sortedArticles.every((article) => article.sourceType !== 'news');
    const actionIconDescription = news.hasLoaded
        ? tr('token.news.refreshTooltip')
        : tr('token.news.fetchTooltip');

    return (
        <div className={styles.newsTab}>
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <h2>{tr('token.news.title')}</h2>
                </div>

                <div className={styles.controls}>
                    <Button
                        kind="tertiary"
                        size="sm"
                        onClick={news.fetchNews}
                        disabled={news.isLoading}
                        iconDescription={actionIconDescription}
                        hasIconOnly
                    >
                        {news.hasLoaded ? <Renew /> : <Download />}
                    </Button>
                </div>
            </div>

            {news.error && (
                <div className={styles.error}>
                    <p>{tr('token.news.error')}</p>
                </div>
            )}

            {news.isLoading && !news.hasLoaded && (
                <div className={styles.loading} aria-busy="true" aria-live="polite">
                    <div className={styles.articlesGrid}>
                        {Array.from({ length: 3 }).map((_, idx) => (
                            <div key={idx} className={styles.loadingCard}>
                                <SkeletonText width="6rem" />
                                <SkeletonText heading width="100%" />
                                <SkeletonText width="100%" />
                                <SkeletonText width="75%" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {news.hasLoaded && !news.isLoading && !news.error && sortedArticles.length === 0 && (
                <div className={styles.empty}>
                    <p>No verified news or related web mentions found for this token.</p>
                    <Button
                        kind="primary"
                        size="sm"
                        onClick={() => news.fetchNews()}
                    >
                        {tr('token.news.tryRefresh')}
                    </Button>
                </div>
            )}

            {sortedArticles.length > 0 && (
                <>
                    {noMajorNewsResults && (
                        <div className={styles.webMentionNotice}>
                            No major news found. Showing related web mentions.
                        </div>
                    )}

                    <div className={styles.articlesGrid}>
                        {visibleArticles.map((article, idx) => (
                            <NewsCard
                                key={article.url || idx}
                                article={article}
                            />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <div className={styles.paginationInfo}>
                                {tr('token.news.showing')} {start}-{end} {tr('token.news.of')} {count}
                            </div>

                            <div className={styles.paginationControls}>
                                <Button
                                    kind="tertiary"
                                    size="sm"
                                    onClick={handlePreviousPage}
                                    disabled={currentNewsPage === 0}
                                    iconDescription={tr('token.news.previousPage')}
                                    hasIconOnly
                                >
                                    <ChevronLeft />
                                </Button>

                                <Button
                                    kind="tertiary"
                                    size="sm"
                                    onClick={handleNextPage}
                                    disabled={currentNewsPage >= totalPages - 1}
                                    iconDescription={tr('token.news.nextPage')}
                                    hasIconOnly
                                >
                                    <ChevronRight />
                                </Button>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
