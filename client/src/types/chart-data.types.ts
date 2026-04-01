/**
 * Chart Data Types
 * 
 * Defines data structures for chart data points and series.
 * 
 * @module chart-data.types
 */

import type { ChartType } from './chart.types';

/**
 * Data point types for different chart visualizations
 */
export type DataPoint = TimeSeriesPoint | CategoricalPoint | DistributionPoint;

/**
 * Time series data point (for line, area, bar over time charts)
 */
export interface TimeSeriesPoint {
  /** Unix timestamp in milliseconds */
  timestamp: number;
  
  /** Numeric value */
  value: number;
  
  /** Optional additional data */
  metadata?: Record<string, unknown>;
}

/**
 * Categorical data point (for bar, grouped bar charts)
 */
export interface CategoricalPoint {
  /** Category label (e.g., exchange name) */
  category: string;
  
  /** Numeric value */
  value: number;
  
  /** Optional additional data */
  metadata?: Record<string, unknown>;
}

/**
 * Distribution data point (for pie, donut charts)
 */
export interface DistributionPoint {
  /** Segment label (e.g., token symbol) */
  name: string;
  
  /** Numeric value (absolute, not percentage) */
  value: number;
  
  /** Optional additional data */
  metadata?: Record<string, unknown>;
}

/**
 * Chart data series representing a single metric
 */
export interface ChartDataSeries {
  /** Unique series identifier */
  id: string;
  
  /** Display name for legend */
  name: string;
  
  /** Visualization type for this series */
  type: ChartType;
  
  /** Array of data points */
  data: DataPoint[];
  
  /** Series color (uses palette if not set) */
  color?: string;
  
  /** Visibility state (toggled via legend) */
  visible: boolean;
  
  /** Y-axis index for dual-axis charts (0 or 1) */
  yAxisIndex?: number;
}

/**
 * Formatted data point for display
 */
export interface FormattedDataPoint {
  /** Raw data point */
  raw: DataPoint;
  
  /** Formatted display values */
  display: {
    /** Formatted date/time (for time series) */
    timestamp?: string;
    
    /** Formatted value ($1.2M, 45%) */
    value: string;
    
    /** Category/name label */
    label: string;
  };
}

/**
 * Type guard to check if data point is time series
 */
export function isTimeSeriesPoint(point: DataPoint): point is TimeSeriesPoint {
  return 'timestamp' in point;
}

/**
 * Type guard to check if data point is categorical
 */
export function isCategoricalPoint(point: DataPoint): point is CategoricalPoint {
  return 'category' in point;
}

/**
 * Type guard to check if data point is distribution
 */
export function isDistributionPoint(point: DataPoint): point is DistributionPoint {
  return 'name' in point && !('category' in point) && !('timestamp' in point);
}
