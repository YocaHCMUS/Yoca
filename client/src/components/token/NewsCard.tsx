/**
 * NewsCard Component
 * Displays a single news article with title, source, favicon, and link
 */

import { Link as LinkIcon } from '@carbon/icons-react';
import styles from './NewsCard.module.scss';
import type { NewsArticle } from '@/types/news';

interface NewsCardProps {
    article: NewsArticle;
}

export function NewsCard({ article }: NewsCardProps) {
    const publishedDate = article.publishedAt
        ? new Date(article.publishedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })
        : null;

    return (
        <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
        >
            <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                    {article.faviconUrl && (
                        <img
                            src={article.faviconUrl}
                            alt={article.sourceName || 'source'}
                            className={styles.favicon}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                    )}
                    <span className={styles.source}>{article.sourceName || 'News'}</span>
                    {publishedDate && (
                        <span className={styles.date}>{publishedDate}</span>
                    )}
                </div>

                <h3 className={styles.title}>{article.title}</h3>

                {article.description && (
                    <p className={styles.description}>{article.description}</p>
                )}

                <div className={styles.cardFooter}>
                    <LinkIcon size={16} className={styles.linkIcon} />
                    <span className={styles.link}>{article.url}</span>
                </div>
            </div>
        </a>
    );
}
