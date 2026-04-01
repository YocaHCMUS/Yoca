/**
 * Core Chart Component Types
 * 
 * Defines the main chart component interfaces and configuration types.
 * 
 * @module chart.types
 */

import type { ChartFilters } from './chart-filters.types';
import type { ChartDataSeries } from './chart-data.types';

/**
 * Chart visualization types supported by the application
 */
export type ChartType =
  | 'line' // Time series line chart
  | 'area' // Time series with area fill
  | 'bar' // Bar chart (single or grouped)
  | 'stackedBar' // Stacked bar chart
  | 'pie' // Pie chart
  | 'donut' // Donut chart
  | 'dualAxis'; // Dual-axis chart (bars + line)

/**
 * Chart viewing modes
 */
export type ViewMode = 'normal' | 'fullscreen' | 'miniPlayer';

/**
 * Chart loading status
 */
export type LoadingStatus =
  | 'idle' // Initial state, no data loaded
  | 'loading' // Data fetch in progress
  | 'success' // Data loaded successfully
  | 'error' // Data fetch failed
  | 'refreshing'; // Auto-refresh in progress (shows previous data)

/**
 * Main chart component configuration
 */
export interface ChartComponent {
  /** Unique identifier for the chart instance */
  id: string;
  
  /** Type of visualization */
  type: ChartType;
  
  /** Display title in header */
  title: string;
  
  /** Chart-specific configuration */
  config: ChartConfiguration;
  
  /** Active filter state */
  filters: ChartFilters;
  
  /** Display mode (normal, fullscreen, mini-player) */
  viewMode: ViewMode;
  
  /** Auto-refresh settings */
  autoRefresh: AutoRefreshConfig;
  
  /** Current data series */
  data: ChartDataSeries[];
  
  /** Loading and error state */
  loadingState: ChartLoadingState;
}

/**
 * Chart axis configuration
 */
export interface AxisConfig {
  /** Axis label text */
  label?: string;
  
  /** Value formatter function */
  formatter?: (value: number | string) => string;
  
  /** Minimum value (auto if not set) */
  min?: number;
  
  /** Maximum value (auto if not set) */
  max?: number;
}

/**
 * Type-safe configuration for chart rendering options
 */
export interface ChartConfiguration {
  // Visual styling
  /** Color palette (uses default if not specified) */
  colors?: string[];
  
  /** Chart height in pixels (default: 400) */
  height?: number;
  
  /** Chart width (default: '100%') */
  width?: string;

  // Data presentation
  /** Display legend (default: true) */
  showLegend?: boolean;
  
  /** Legend placement */
  legendPosition?: 'left' | 'right' | 'top' | 'bottom';
  
  /** Enable tooltips (default: true) */
  showTooltip?: boolean;
  
  /** Show values on data points (default: false) */
  showDataLabels?: boolean;

  // Axes configuration (for time series/bar charts)
  /** X-axis configuration */
  xAxis?: AxisConfig;
  
  /** Y-axis configuration (array for dual-axis charts) */
  yAxis?: AxisConfig | AxisConfig[];

  // Time series specific
  /** IANA timezone (default: user's local) */
  timezone?: string;
  
  /** date-fns format string */
  dateFormat?: string;

  // Performance
  /** Enable LTTB sampling for large datasets */
  enableSampling?: boolean;
  
  /** Point count threshold (default: 2000) */
  samplingThreshold?: number;

  // Export settings
  /** Base filename for exports */
  exportFilename?: string;
}

/**
 * Auto-refresh configuration
 */
export interface AutoRefreshConfig {
  /** Enable/disable auto-refresh */
  enabled: boolean;
  
  /** Refresh interval in milliseconds */
  interval: number;
  
  /** Pause during user interaction */
  pauseOnInteraction: boolean;
  
  /** Stagger offset to prevent simultaneous refreshes */
  staggerOffset?: number;
  
  /** Timestamp of last successful refresh */
  lastRefresh?: Date;
}

/**
 * Chart loading and error states
 */
export interface ChartLoadingState {
  /** Current loading status */
  status: LoadingStatus;
  
  /** Error details if status is 'error' */
  error?: ChartError;
  
  /** Number of retry attempts */
  retryCount: number;
  
  /** Timestamp of last fetch attempt */
  lastAttempt?: Date;
}

/**
 * Chart error details
 */
export interface ChartError {
  /** Error code (e.g., 'NETWORK_ERROR', 'INVALID_DATA') */
  code: string;
  
  /** User-friendly error message */
  message: string;
  
  /** Technical error details (for logging) */
  technical?: string;
  
  /** Whether error is retryable */
  retryable: boolean;
}

/**
 * View mode state management
 */
export interface ViewModeState {
  /** Current view mode */
  mode: ViewMode;
  
  /** Mini-player position */
  position?: Position;
  
  /** Mini-player size */
  size?: Size;
  
  /** Previous mode (for restoration) */
  previousMode?: ViewMode;
}

/**
 * Position coordinates
 */
export interface Position {
  /** X coordinate (pixels from left) */
  x: number;
  
  /** Y coordinate (pixels from top) */
  y: number;
}

/**
 * Size dimensions
 */
export interface Size {
  /** Width in pixels */
  width: number;
  
  /** Height in pixels */
  height: number;
}

/**
 * Default auto-refresh configuration
 */
export const DEFAULT_AUTO_REFRESH: AutoRefreshConfig = {
  enabled: true,
  interval: 30000, // 30 seconds
  pauseOnInteraction: true,
  staggerOffset: undefined,
  lastRefresh: undefined,
};

/**
 * Default chart configuration
 */
export const DEFAULT_CHART_CONFIG: Partial<ChartConfiguration> = {
  height: 400,
  width: '100%',
  showLegend: true,
  legendPosition: 'bottom',
  showTooltip: true,
  showDataLabels: false,
  enableSampling: true,
  samplingThreshold: 2000,
};

/**
 * Default mini-player state
 */
export const DEFAULT_MINI_PLAYER_STATE: ViewModeState = {
  mode: 'miniPlayer',
  position: { x: 100, y: 100 },
  size: { width: 400, height: 300 },
  previousMode: 'normal',
};
