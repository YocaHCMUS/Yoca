/**
 * ChartWrapper Component
 * 
 * Base wrapper component for all chart types with header, controls, and state management.
 * 
 * @module ChartWrapper
 */

import React, { useRef } from 'react';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartErrorState } from './ChartErrorState';
import type { ChartLoadingState } from '../../../types/chart.types';
import styles from './ChartWrapper.module.scss';

/**
 * Props for ChartWrapper component
 */
interface ChartWrapperProps {
  /** Chart title */
  title: string;
  
  /** Loading state */
  loadingState: ChartLoadingState;
  
  /** Chart content (rendered when loaded) */
  children: React.ReactNode;
  
  /** Header actions (export, fullscreen, etc.) */
  actions?: React.ReactNode;
  
  /** Chart height */
  height?: number;
  
  /** Show legend skeleton in loading state */
  showLegend?: boolean;
  
  /** Retry callback for error state */
  onRetry?: () => void;
  
  /** Empty state configuration */
  emptyState?: {
    title?: string;
    message?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  
  /** Additional class name */
  className?: string;
  
  /** Whether data is empty */
  isEmpty?: boolean;
}

/**
 * ChartWrapper Component
 * 
 * Provides consistent header, loading states, error handling, and empty states for all charts.
 * 
 * @example
 * ```tsx
 * <ChartWrapper
 *   title="Balance Trend"
 *   loadingState={loadingState}
 *   actions={<ExportButton />}
 *   height={400}
 *   onRetry={fetchData}
 *   isEmpty={data.length === 0}
 * >
 *   <ReactECharts option={chartOption} />
 * </ChartWrapper>
 * ```
 */
export function ChartWrapper({
  title,
  loadingState,
  children,
  actions,
  height = 400,
  showLegend = true,
  onRetry,
  emptyState,
  className,
  isEmpty = false,
}: ChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div
      ref={containerRef}
      className={`${styles.wrapper} ${className || ''}`}
      data-testid="chart-wrapper"
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>{title}</h2>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      
      {/* Content area */}
      <div className={styles.content}>
        {/* Loading state */}
        {loadingState.status === 'loading' && (
          <ChartSkeleton
            height={height}
            showHeader={false}
            showLegend={showLegend}
          />
        )}
        
        {/* Error state */}
        {loadingState.status === 'error' && loadingState.error && (
          <ChartErrorState
            error={loadingState.error}
            onRetry={onRetry}
            height={height}
          />
        )}
        
        {/* Empty state */}
        {loadingState.status === 'success' && isEmpty && (
          <ChartEmptyState
            title={emptyState?.title}
            message={emptyState?.message}
            action={emptyState?.action}
            height={height}
          />
        )}
        
        {/* Chart content (success with data or refreshing) */}
        {(loadingState.status === 'success' || loadingState.status === 'refreshing') &&
          !isEmpty && (
            <div className={styles.chartContainer}>
              {children}
            </div>
          )}
      </div>
    </div>
  );
}
