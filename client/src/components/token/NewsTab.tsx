/**
 * NewsTab Component
 * Displays news articles for a token with refresh, filtering, and pagination
 */

import { useEffect, useState } from 'react';
import { Download, Renew } from '@carbon/icons-react';
import { Button, SkeletonText } from '@carbon/react';
import { useLocalization } from '@/contexts/LocalizationContext';
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
    const { tr } = useLocalization();
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

    const start = String(filteredEntries.length === 0 ? 0 : page * ARTICLES_PER_PAGE + 1);
    const end = String(Math.min((page + 1) * ARTICLES_PER_PAGE, filteredEntries.length));
    const count = String(filteredEntries.length);
    const actionLabel = news.hasLoaded ? tr('token.news.refresh') : tr('token.news.fetch');
    const actionIconDescription = news.hasLoaded
        ? tr('token.news.refreshTooltip')
        : tr('token.news.fetchTooltip');

    return (
        <div className={styles.newsTab}>
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <h2>{tr('token.news.title')}</h2>
                    {news.cached && (
                        <span className={styles.cachedBadge} title={tr('token.news.cachedTooltip')}>
                            {tr('token.news.cached')}
                        </span>
                    )}
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
                    <p>{tr('token.news.errorPrefix')} {news.error}</p>
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

            {news.hasLoaded && !news.isLoading && filteredEntries.length === 0 && (
                <div className={styles.empty}>
                    <p>{tr('token.news.empty', { name })}</p>
                    <Button
                        kind="primary"
                        size="sm"
                        onClick={() => news.fetchNews()}
                    >
                        {tr('token.news.tryRefresh')}
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
                                {tr('token.news.showing')} {start}–{end} {tr('token.news.of')} {count}
                            </div>

                            {page < totalPages - 1 && (
                                <Button
                                    kind="secondary"
                                    size="sm"
                                    onClick={handleLoadMore}
                                >
                                    {tr('token.news.loadMore')}
                                </Button>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
