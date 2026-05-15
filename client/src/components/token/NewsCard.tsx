/**
 * NewsCard Component
 * Displays a single news article with inline expansion.
 */

import React from 'react';
import { ChevronDown, ChevronUp, Link as LinkIcon } from '@carbon/icons-react';
import ReactECharts from 'echarts-for-react';
import { useLocalization } from '@/contexts/LocalizationContext';
import styles from './NewsCard.module.scss';
import type { NewsArticle, NewsArticleExpansion } from '@/types/news';
import { EChartsOption } from 'echarts';

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
        ? fmt.datetime.date(publishedAt)
        : null;

    const context = expansion?.context ?? article.context ?? null;
    const snippets = expansion?.extraSnippets ?? article.extraSnippets ?? [];
    const priceSeries = context?.priceSeries ?? null;
    const marketCapSeries = context?.marketCapSeries ?? null;

    // compute marker label (nearest) for publishedAt
    let markerLabel: string | null = null;
    if (context && context.labels && publishedAt) {
        const pubMs = publishedAt.getTime();
        let bestIdx = -1;
        let bestDiff = Infinity;
        for (let i = 0; i < context.labels.length; i++) {
            const ts = Date.parse(context.labels[i]);
            if (Number.isNaN(ts)) continue;
            const diff = Math.abs(ts - pubMs);
            if (diff < bestDiff) {
                bestDiff = diff;
                bestIdx = i;
            }
        }
        if (bestIdx >= 0) markerLabel = context.labels[bestIdx];
    }

    const buildOption = (labels: string[] | null, data: (number | null)[] | null, color = '#0072c3') => {
        const serie = (data ?? []).map((v) => (v === null || v === undefined ? null : v));
        const x = labels ?? serie.map((_, i) => String(i));
        const option: EChartsOption = {
            grid: { left: 4, right: 4, top: 18, bottom: 8, containLabel: true },
            xAxis: {
                type: 'category',
                data: x,
                axisLabel: {
                    formatter: (value: string) => {
                        // const date = Date.parse(value);
                        return fmt.datetime.date(value); // for side effect of locale formatting
                    }

                }
            },
            yAxis: {
                type: 'value',
                scale: true,
                splitLine: { show: false },
                axisLabel: {
                    formatter: (value: number) => (fmt.num.compact.currency(value)),
                },
            },
            series: [
                {
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 1.2, color },
                    data: serie,
                    connectNulls: true,
                    markPoint: markerLabel
                        ? {
                            symbol: 'circle',
                            symbolSize: 10,
                            label: {
                                show: true,
                                formatter: () => tr('token.news.posted'),
                                color: '#0f62fe',
                                position: 'top',
                            },
                            itemStyle: {
                                color: '#0f62fe',
                                borderColor: '#ffffff',
                                borderWidth: 2,
                            },
                            data: (() => {
                                const markerIndex = x.indexOf(markerLabel);
                                const markerValue = markerIndex >= 0 ? serie[markerIndex] : null;
                                const yValue = typeof markerValue === 'number'
                                    ? markerValue
                                    : (serie.find((value): value is number => typeof value === 'number') ?? 0);

                                const postedLabel = tr('token.news.posted');
                                return [{ name: postedLabel, coord: [markerLabel, yValue], value: postedLabel }];
                            })(),
                        }
                        : undefined,
                },
            ],
            tooltip: {
                show: true,
                trigger: 'axis',
                confine: true,
                formatter: (params: any) => {
                    const point = Array.isArray(params) ? params[0] : params;
                    // const label = point?.axisValue ? datetimeFormatter.format(new Date(Date.parse(point.axisValue))) : '';
                    const label = point?.axisValue ? fmt.datetime.date(Date.parse(point.axisValue)) : '';
                    const value = typeof point?.data === 'number' ? point.data : point?.value;
                    return `${label}<br/>${fmt.num.compact.currency(value) ?? '-'}`;
                },
            },
            animation: false,
        };
        return option;
    };

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
                                <div className={styles.contextChart}>
                                    <div className={styles.contextChartHeader}>{tr('token.news.priceChartTitle')}</div>
                                    <div className={styles.contextChartBody}>
                                        <div style={{ width: '100%', height: 120 }}>
                                            <ReactECharts option={buildOption(context?.labels ?? null, priceSeries, '#0072c3')} style={{ width: '100%', height: '100%' }} notMerge={true} lazyUpdate={true} />
                                        </div>
                                    </div>
                                </div>
                                // <div className={styles.contextGrid}>
                                //     <div className={styles.contextChart}>
                                //         <div className={styles.contextChartHeader}>{tr('token.news.priceChartTitle')}</div>
                                //         <div className={styles.contextChartBody}>
                                //             <div style={{ width: '100%', height: 120 }}>
                                //                 <ReactECharts option={buildOption(context?.labels ?? null, priceSeries, '#0072c3')} style={{ width: '100%', height: '100%' }} notMerge={true} lazyUpdate={true} />
                                //             </div>
                                //         </div>
                                //     </div>
                                //     <div className={styles.contextChart}>
                                //         <div className={styles.contextChartHeader}>{tr('token.news.marketCapChartTitle')}</div>
                                //         <div className={styles.contextChartBody}>
                                //             <div style={{ width: '100%', height: 120 }}>
                                //                 <ReactECharts option={buildOption(context?.labels ?? null, marketCapSeries, '#945200')} style={{ width: '100%', height: '100%' }} notMerge={true} lazyUpdate={true} />
                                //             </div>
                                //         </div>
                                //     </div>
                                // </div>
                            ) : (
                                <p className={styles.mutedText}>{tr('token.news.noContext')}</p>
                            )}
                        </section>

                        <div className={styles.expandedMeta}>
                            {/* <span>{tr('token.news.tokenContextLabel', { symbol: expansion?.token.symbol || article.sourceName || '' })}</span> */}
                            {isLoadingExpansion && <span>{tr('token.news.loadingContext')}</span>}
                        </div>
                    </div>
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
