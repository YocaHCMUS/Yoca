/**
 * ChartEmptyState Component
 * 
 * Displays when chart has no data to show.
 * 
 * @module ChartEmptyState
 */

import { useTranslation } from 'react-i18next';
import styles from './ChartEmptyState.module.scss';

/**
 * Props for ChartEmptyState component
 */
interface ChartEmptyStateProps {
  /** Optional custom title */
  title?: string;
  
  /** Optional custom message */
  message?: string;
  
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  
  /** Chart height to match container */
  height?: number;
}

/**
 * ChartEmptyState Component
 * 
 * Shows a user-friendly empty state when chart has no data.
 * 
 * @example
 * ```tsx
 * {data.length === 0 && (
 *   <ChartEmptyState
 *     title="No Data Available"
 *     message="Try adjusting your filters or date range"
 *     action={{ label: 'Reset Filters', onClick: resetFilters }}
 *   />
 * )}
 * ```
 */
export function ChartEmptyState({
  title,
  message,
  action,
  height = 400,
}: ChartEmptyStateProps) {
  const { t } = useTranslation();
  
  const defaultTitle = title || t('charts.noDataTitle');
  const defaultMessage = message || t('charts.noDataMessage');
  
  return (
    <div
      className={styles.emptyState}
      style={{ height: `${height}px` }}
      data-testid="chart-empty-state"
    >
      <div className={styles.content}>
        <svg
          className={styles.icon}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 32 32"
          fill="currentColor"
        >
          <path d="M28 28H4a2 2 0 01-2-2V6a2 2 0 012-2h24a2 2 0 012 2v20a2 2 0 01-2 2zM4 6v20h24V6z" />
          <path d="M8 10h16v2H8zM8 14h16v2H8zM8 18h10v2H8z" />
        </svg>
        
        <h3 className={styles.title}>{defaultTitle}</h3>
        <p className={styles.message}>{defaultMessage}</p>
        
        {action && (
          <button
            className={styles.actionButton}
            onClick={action.onClick}
            type="button"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
