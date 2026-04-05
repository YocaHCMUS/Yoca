/**
 * ChartContainer Component
 * 
 * Reusable container layout for multi-section charts.
 * Provides consistent spacing and layout patterns.
 * 
 * @module components/charts/shared/ChartContainer
 */

import React from 'react';
import styles from './ChartContainer.module.scss';

interface ChartContainerProps {
  /** Container children (chart sections) */
  children: React.ReactNode;
  
  /** Layout direction (default: 'column') */
  direction?: 'column' | 'row';
  
  /** Gap size between sections (default: '1.5rem') */
  gap?: string;
  
  /** Additional class name */
  className?: string;
}

/**
 * ChartContainer Component
 * 
 * Provides a flex container for organizing chart sections with consistent spacing.
 * 
 * @example
 * ```tsx
 * <ChartContainer>
 *   <ChartStatsHeader cards={statsCards} />
 *   <ReactECharts option={chartOption} />
 * </ChartContainer>
 * ```
 */
export function ChartContainer({
  children,
  direction = 'column',
  gap = '1.5rem',
  className,
}: ChartContainerProps) {
  return (
    <div 
      className={`${styles.container} ${styles[`direction-${direction}`]} ${className || ''}`}
      style={{ '--gap': gap } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

interface ChartSectionProps {
  /** Section children */
  children: React.ReactNode;
  
  /** Minimum height */
  minHeight?: string;
  
  /** Additional class name */
  className?: string;
}

/**
 * ChartSection Component
 * 
 * Individual section within a ChartContainer.
 * 
 * @example
 * ```tsx
 * <ChartContainer>
 *   <ChartSection minHeight="300px">
 *     <ReactECharts option={option1} />
 *   </ChartSection>
 *   <ChartSection minHeight="300px">
 *     <ReactECharts option={option2} />
 *   </ChartSection>
 * </ChartContainer>
 * ```
 */
export function ChartSection({
  children,
  minHeight,
  className,
}: ChartSectionProps) {
  return (
    <div 
      className={`${styles.section} ${className || ''}`}
      style={minHeight ? { minHeight } : undefined}
    >
      {children}
    </div>
  );
}
