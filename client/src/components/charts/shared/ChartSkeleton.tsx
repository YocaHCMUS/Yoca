/**
 * ChartSkeleton Component
 * 
 * Loading skeleton for chart components using Carbon Design System.
 * 
 * @module ChartSkeleton
 */

import { SkeletonPlaceholder } from '@carbon/react';
import styles from './ChartSkeleton.module.scss';

/**
 * Props for ChartSkeleton component
 */
interface ChartSkeletonProps {
  /** Chart height in pixels */
  height?: number;
  
  /** Whether to show header skeleton */
  showHeader?: boolean;
  
  /** Whether to show legend skeleton */
  showLegend?: boolean;
}

/**
 * ChartSkeleton Component
 * 
 * Displays a loading skeleton while chart data is being fetched.
 * 
 * @example
 * ```tsx
 * {loadingState.status === 'loading' && (
 *   <ChartSkeleton height={400} showHeader showLegend />
 * )}
 * ```
 */
export function ChartSkeleton({
  height = 400,
  showHeader = true,
  showLegend = true,
}: ChartSkeletonProps) {
  return (
    <div className={styles.skeleton} data-testid="chart-skeleton">
      {showHeader && (
        <div className={styles.header}>
          <SkeletonPlaceholder className={styles.title} />
          <div className={styles.actions}>
            <SkeletonPlaceholder className={styles.actionButton} />
            <SkeletonPlaceholder className={styles.actionButton} />
            <SkeletonPlaceholder className={styles.actionButton} />
          </div>
        </div>
      )}
      
      <div className={styles.chartArea} style={{ height: `${height}px` }}>
        <SkeletonPlaceholder className={styles.chartPlaceholder} />
      </div>
      
      {showLegend && (
        <div className={styles.legend}>
          <SkeletonPlaceholder className={styles.legendItem} />
          <SkeletonPlaceholder className={styles.legendItem} />
          <SkeletonPlaceholder className={styles.legendItem} />
        </div>
      )}
    </div>
  );
}
