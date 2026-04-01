/**
 * ChartStatsHeader Component
 * 
 * Reusable stats header layout for charts that display metrics above the chart.
 * Provides a consistent grid layout with stat cards.
 * 
 * @module components/charts/shared/ChartStatsHeader
 */

import React from 'react';
import styles from './ChartStatsHeader.module.scss';

export interface StatItem {
  /** Stat label/name */
  label: string;
  
  /** Stat value (can be string or number) */
  value: string | number;
  
  /** Optional icon or prefix */
  prefix?: React.ReactNode;
  
  /** Optional suffix (e.g., '%', 'days') */
  suffix?: string;
  
  /** Optional value color class */
  valueClassName?: string;
}

export interface StatCard {
  /** Optional card title/header */
  title?: string;
  
  /** Stats to display in this card */
  stats: StatItem[];
}

interface ChartStatsHeaderProps {
  /** Array of stat cards to display */
  cards: StatCard[];
  
  /** Minimum column width (default: '200px') */
  minColumnWidth?: string;
  
  /** Additional class name */
  className?: string;
}

/**
 * ChartStatsHeader Component
 * 
 * Displays a responsive grid of stat cards with consistent styling.
 * 
 * @example
 * ```tsx
 * <ChartStatsHeader
 *   cards={[
 *     {
 *       title: 'Wallet A',
 *       stats: [
 *         { label: 'Max Drawdown', value: '-25.5', suffix: '%' },
 *         { label: 'Duration', value: '14', suffix: 'days' }
 *       ]
 *     }
 *   ]}
 * />
 * ```
 */
export function ChartStatsHeader({
  cards,
  minColumnWidth = '200px',
  className,
}: ChartStatsHeaderProps) {
  if (!cards || cards.length === 0) {
    return null;
  }

  return (
    <div 
      className={`${styles.statsHeader} ${className || ''}`}
      style={{ '--min-column-width': minColumnWidth } as React.CSSProperties}
    >
      {cards.map((card, cardIndex) => (
        <div key={cardIndex} className={styles.statCard}>
          {card.title && (
            <div className={styles.cardTitle}>{card.title}</div>
          )}
          <div className={styles.statsGrid}>
            {card.stats.map((stat, statIndex) => (
              <div key={statIndex} className={styles.statItem}>
                <div className={styles.statLabel}>{stat.label}</div>
                <div className={`${styles.statValue} ${stat.valueClassName || ''}`}>
                  {stat.prefix}
                  {stat.value}
                  {stat.suffix && <span className={styles.statSuffix}>{stat.suffix}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
