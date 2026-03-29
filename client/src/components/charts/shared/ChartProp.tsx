/**
 * Common Chart Props
 *
 * Standardized prop interface for all chart components.
 * Ensures consistency across chart implementations.
 *
 * @module components/charts/shared/ChartProp
 */

import type { ChartFilters } from "@/types/chart-filters.types";

/**
 * Base props shared by all chart components
 */
export interface ChartProps {
  /** Chart title (overrides default i18n title) */
  title?: string;

  /** Minimum chart height in pixels (default: 400) */
  minHeight?: number;

  /** Initial filter values (wallets, timePeriod, tokens, etc.) */
  initialFilters?: Partial<ChartFilters>;

  /** Token options used by selector controls (BalanceChart) */
  tokenSelectorOptions?: string[];

  /** Maximum selectable token tags for balance chart in single-wallet mode */
  maxTokenTags?: number;

  /** Enable automatic data refresh (default: true) */
  autoRefresh?: boolean;

  /** Auto-refresh interval in milliseconds (default: 30000) */
  refreshInterval?: number;

  /** Additional CSS class name */
  className?: string;

  /** Callback when data is loaded */
  onDataLoaded?: (data: any) => void;

  /** Callback when an error occurs */
  onError?: (error: Error) => void;
}

/**
 * Extended props for charts with export functionality
 */
export interface ChartPropsWithExport extends ChartProps {
  /** Enable export functionality (default: true) */
  enableExport?: boolean;

  /** Custom export filename prefix */
  exportFilename?: string;
}

/**
 * Extended props for charts with view mode options
 */
export interface ChartPropsWithViewMode extends ChartProps {
  /** Initial view mode */
  initialViewMode?: string;

  /** Available view modes */
  viewModes?: string[];
}
