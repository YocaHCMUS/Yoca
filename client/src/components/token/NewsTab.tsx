/**
 * NewsTab Component
 * Displays news articles for a token with refresh, filtering, and pagination
 */

import { useEffect, useState } from 'react';
import { Renew, Filter } from '@carbon/icons-react';
import { Button, Loading } from '@carbon/react';
import { NewsCard } from './NewsCard';
import { useNewsFeed } from '@/hooks/useNewsFeed';
import type { TokenNewsQuery } from '@/types/news';
import styles from './NewsTab.module.scss';

interface NewsTabProps {
    address: string;
    symbol: string;
    name: string;
}

const ARTICLES_PER_PAGE = 10;

export function NewsTab({ address, symbol, name }: NewsTabProps) {
    const query: TokenNewsQuery = { address, symbol, name };
    const news = useNewsFeed(query);
    const [page, setPage] = useState(0);
    const [filteredEntries, setFilteredEntries] = useState(news.entries);

    useEffect(() => {
        setFilteredEntries(news.entries);
        setPage(0);
    }, [news.entries]);

    const totalPages = Math.ceil(filteredEntries.length / ARTICLES_PER_PAGE);
    const paginatedEntries = filteredEntries.slice(
        page * ARTICLES_PER_PAGE,
        (page + 1) * ARTICLES_PER_PAGE,
    );

    const handleLoadMore = () => {
        if (page < totalPages - 1) {
            setPage(page + 1);
        }
    };

    return (
        <div className={styles.newsTab}>
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <h2>News & Updates</h2>
                    {news.cached && (
                        <span className={styles.cachedBadge} title="Cached from recent fetch">
                            Cached
                        </span>
                    )}
                </div>

                <div className={styles.controls}>
                    <Button
                        kind="tertiary"
                        size="sm"
                        onClick={() => news.refresh()}
                        disabled={news.isLoading}
                        iconDescription="Refresh"
                        hasIconOnly
                    >
                        <Renew />
                    </Button>
                </div>
            </div>

            {news.error && (
                <div className={styles.error}>
                    <p>Error loading news: {news.error}</p>
                </div>
            )}

            {news.isLoading && !news.hasLoaded && (
                <div className={styles.loading}>
                    <Loading description="Loading news..." />
                </div>
            )}

            {news.hasLoaded && !news.isLoading && filteredEntries.length === 0 && (
                <div className={styles.empty}>
                    <p>No news articles found for {name}.</p>
                    <Button
                        kind="primary"
                        size="sm"
                        onClick={() => news.fetchNews()}
                    >
                        Try Refreshing
                    </Button>
                </div>
            )}

            {filteredEntries.length > 0 && (
                <>
                    <div className={styles.articlesGrid}>
                        {paginatedEntries.map((article, idx) => (
                            <NewsCard key={article.contentHash || idx} article={article} />
                        ))}
                    </div>

                    {totalPages > 1 && (
                        <div className={styles.pagination}>
                            <div className={styles.paginationInfo}>
                                Showing {page * ARTICLES_PER_PAGE + 1}–
                                {Math.min((page + 1) * ARTICLES_PER_PAGE, filteredEntries.length)} of{' '}
                                {filteredEntries.length}
                            </div>

                            {page < totalPages - 1 && (
                                <Button
                                    kind="secondary"
                                    size="sm"
                                    onClick={handleLoadMore}
                                >
                                    Load More
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
