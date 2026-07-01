/**
 * NewsCard Component
 * Displays a compact RSS news article.
 */

import { Link as LinkIcon } from '@carbon/icons-react';
import { useMemo, useState } from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';
import styles from './NewsCard.module.scss';
import type { NewsArticle } from '@/types/news';

interface NewsCardProps {
    article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
    const { tr, fmt } = useLocalization();
    const [thumbnailFailed, setThumbnailFailed] = useState(false);
    const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
    const publishedDate = publishedAt && !Number.isNaN(publishedAt.getTime())
        ? fmt.datetime.date(publishedAt)
        : null;
    const sourceLabel = article.sourceName || article.source || tr('token.news.sourceFallback');
    const thumbnailSrc = thumbnailFailed
        ? null
        : article.imageUrl || article.faviconUrl || article.favicon || null;
    const placeholderLabel = useMemo(
        () => sourceLabel.trim().slice(0, 1).toUpperCase() || 'N',
        [sourceLabel],
    );

    return (
        <article className={styles.card}>
            <div className={styles.thumbnailWrap}>
                {thumbnailSrc ? (
                    <img
                        src={thumbnailSrc}
                        alt=""
                        className={styles.thumbnail}
                        loading="lazy"
                        onError={() => setThumbnailFailed(true)}
                    />
                ) : (
                    <div className={styles.thumbnailPlaceholder} aria-hidden="true">
                        {placeholderLabel}
                    </div>
                )}
            </div>
            <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                    <div className={styles.sourceRow}>
                        {(article.faviconUrl || article.favicon) && (
                            <img
                                src={article.faviconUrl || article.favicon || undefined}
                                alt={tr('token.news.sourceAlt')}
                                className={styles.favicon}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        )}
                        <span className={styles.source}>{sourceLabel}</span>
                    </div>
                </div>

                <h3 className={styles.title}>{article.title}</h3>

                {article.description && (
                    <p className={styles.description}>{article.description}</p>
                )}

                <div className={styles.cardFooter}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.link} title={tr('token.news.openArticle')}>
                        <LinkIcon size={16} className={styles.linkIcon} />
                        <span>{tr('token.news.openArticle')}</span>
                    </a>

                    {publishedDate && <span className={styles.date}>{publishedDate}</span>}

                </div>
            </div>
        </article>
    );
}
