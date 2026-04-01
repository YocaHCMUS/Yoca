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

  /** Whether to show compact placeholders for header actions */
  showActionPlaceholders?: boolean;
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
}: ChartSkeletonProps) {
  return (
    <SkeletonPlaceholder
      className={styles.skeleton}
      data-testid="chart-skeleton"
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
