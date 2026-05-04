/**
 * NewsCard Component
 * Displays a single news article with inline expansion.
 */

import { ChevronDown, ChevronUp, Link as LinkIcon } from '@carbon/icons-react';
import SparklineChart from '@/components/charts/SparklineChart';
import { useLocalization } from '@/contexts/LocalizationContext';
import styles from './NewsCard.module.scss';
import type { NewsArticle, NewsArticleExpansion } from '@/types/news';

interface NewsCardProps {
    article: NewsArticle;
    isExpanded: boolean;
    isLoadingExpansion: boolean;
    expansion: NewsArticleExpansion | null;
    onToggleExpand: (article: NewsArticle) => void;
}

export function NewsCard({ article, isExpanded, isLoadingExpansion, expansion, onToggleExpand }: NewsCardProps) {
    const { tr, fmt } = useLocalization();
    const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
    const publishedDate = publishedAt && !Number.isNaN(publishedAt.getTime())
        ? fmt.datetime.datetime(publishedAt)
        : null;

    const context = expansion?.context ?? article.context ?? null;
    const snippets = expansion?.extraSnippets ?? article.extraSnippets ?? [];
    const priceSeries = context?.priceSeries.filter((value): value is number => typeof value === 'number') ?? null;
    const marketCapSeries = context?.marketCapSeries.filter((value): value is number => typeof value === 'number') ?? null;

    return (
        <article className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''}`}>
            <div className={styles.cardContent}>
                <div className={styles.cardHeader}>
                    <div className={styles.sourceRow}>
                        {article.faviconUrl && (
                            <img
                                src={article.faviconUrl}
                                alt={tr('token.news.sourceAlt')}
                                className={styles.favicon}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                }}
                            />
                        )}
                        <span className={styles.source}>{article.sourceName || tr('token.news.sourceFallback')}</span>
                    </div>

                    <div className={styles.headerActions}>
                        {publishedDate && <span className={styles.date}>{publishedDate}</span>}
                        <button
                            type="button"
                            className={styles.expandButton}
                            onClick={() => onToggleExpand(article)}
                            aria-expanded={isExpanded}
                            aria-label={isExpanded ? tr('token.news.collapse') : tr('token.news.expand')}
                        >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            <span>{isExpanded ? tr('token.news.collapse') : tr('token.news.expand')}</span>
                        </button>
                    </div>
                </div>

                <h3 className={styles.title}>{article.title}</h3>

                {article.description && (
                    <p className={styles.description}>{article.description}</p>
                )}

                {isExpanded && (
                    <div className={styles.expandedBody}>
                        <section className={styles.detailSection} aria-label={tr('token.news.snippetsTitle')}>
                            <h4 className={styles.sectionTitle}>{tr('token.news.snippetsTitle')}</h4>
                            {snippets.length > 0 ? (
                                <ul className={styles.snippetList}>
                                    {snippets.map((snippet, idx) => (
                                        <li key={`${article.contentHash || article.url}-snippet-${idx}`} className={styles.snippetItem}>
                                            {snippet}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className={styles.mutedText}>{tr('token.news.noSnippets')}</p>
                            )}
                        </section>

                        <section className={styles.detailSection} aria-label={tr('token.news.contextTitle')}>
                            <h4 className={styles.sectionTitle}>{tr('token.news.contextTitle')}</h4>

                            {context && context.labels.length > 0 ? (
                                <div className={styles.contextGrid}>
                                    <div className={styles.contextChart}>
                                        <div className={styles.contextChartHeader}>{tr('token.news.priceChartTitle')}</div>
                                        <div className={styles.contextChartBody}>
                                            <SparklineChart data={priceSeries} />
                                        </div>
                                    </div>
                                    <div className={styles.contextChart}>
                                        <div className={styles.contextChartHeader}>{tr('token.news.marketCapChartTitle')}</div>
                                        <div className={styles.contextChartBody}>
                                            <SparklineChart data={marketCapSeries} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className={styles.mutedText}>{tr('token.news.noContext')}</p>
                            )}
                        </section>

                        <div className={styles.expandedMeta}>
                            <span>{tr('token.news.tokenContextLabel', { symbol: expansion?.token.symbol || article.sourceName || '' })}</span>
                            {isLoadingExpansion && <span>{tr('token.news.loadingContext')}</span>}
                        </div>
                    </div>
                )}

                <div className={styles.cardFooter}>
                    <a href={article.url} target="_blank" rel="noopener noreferrer" className={styles.link} title={tr('token.news.openArticle')}>
                        <LinkIcon size={16} className={styles.linkIcon} />
                        <span>{tr('token.news.openArticle')}</span>
                    </a>
                </div>
            </div>
        </article>
    );
}
