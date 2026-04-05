/**
 * ChartErrorState Component
 * 
 * Displays when chart encounters an error loading data.
 * 
 * @module ChartErrorState
 */

import { useLocalization } from '@/contexts/LocalizationContext';
import type { ChartError } from '../../../types/chart.types';
import styles from './ChartErrorState.module.scss';

/**
 * Props for ChartErrorState component
 */
interface ChartErrorStateProps {
  /** Error details */
  error: ChartError;
  
  /** Retry callback */
  onRetry?: () => void;
  
  /** Chart height to match container */
  height?: number;
}

/**
 * ChartErrorState Component
 * 
 * Shows a user-friendly error state with retry option.
 * 
 * @example
 * ```tsx
 * {loadingState.status === 'error' && loadingState.error && (
 *   <ChartErrorState
 *     error={loadingState.error}
 *     onRetry={fetchData}
 *   />
 * )}
 * ```
 */
export function ChartErrorState({
  error,
  onRetry,
  height = 400,
}: ChartErrorStateProps) {
  const { tr } = useLocalization();
  
  return (
    <div
      className={styles.errorState}
      style={{ height: `${height}px` }}
      data-testid="chart-error-state"
    >
      <div className={styles.content}>
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="currentColor"
        >
          <path d="M16 2a14 14 0 1014 14A14 14 0 0016 2zm0 26a12 12 0 1112-12 12 12 0 01-12 12z" />
          <path d="M15 8h2v11h-2zM15 21h2v2h-2z" />
        </svg>
        
        <h3 className={styles.title}>{tr('charts.errorTitle')}</h3>
        <p className={styles.message}>{error.message}</p>
        
        {error.retryable && onRetry && (
          <button
            className={styles.retryButton}
            onClick={onRetry}
            type="button"
          >
            {tr('charts.retry')}
          </button>
        )}
        
        {error.technical && (
          <details className={styles.details}>
            <summary className={styles.detailsSummary}>{tr('charts.technicalDetails')}</summary>
            <pre className={styles.technicalError}>{error.technical}</pre>
          </details>
        )}
      </div>
    </div>
  );
}
