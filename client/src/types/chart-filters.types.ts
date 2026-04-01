/**
 * Chart Filter Types
 *
 * Defines filter-related types and interfaces for chart data filtering.
 *
 * @module chart-filters.types
 */

/**
 * Time period filter options
 */
export type TimePeriod =
  | "24H"
  | "7D"
  | "30D"
  | "60D"
  | "90D"
  | "1Y"
  | "All"
  | "custom";

/**
 * Transaction type filter options
 */
export type TransactionType =
  | "all" // All transaction types
  | "trades" // Only trade transactions
  | "transfers" // Only transfer transactions
  | "deposits" // Only deposits
  | "withdrawals"; // Only withdrawals

/**
 * Date range for custom time periods
 */
export interface DateRange {
  /** Start date (inclusive) */
  start: Date;

  /** End date (inclusive) */
  end: Date;
}

/**
 * Chart filter state
 */
export interface ChartFilters {
  /** Time range filter */
  timePeriod: TimePeriod;

  timeUnit: "month" | "quater" | "year" | "days" | "custom";

  /** Selected tokens (['All'] or specific tokens) */
  tokens?: string[];

  topN: number;

  /** Transaction type filter */
  transactionType: TransactionType;

  /** limit the amount of data used (default: 2000) */
  limit?: number;

  /** Optional wallet filter */
  wallets?: string[];

  /** Custom date range (if timePeriod is 'custom') */
  customDateRange?: DateRange;
}

/**
 * Export format options
 */
export type ExportFormat = "png" | "svg" | "csv" | "pdf";

/**
 * Export configuration
 */
export interface ExportConfig {
  /** Export file format */
  format: ExportFormat;

  /** Include metadata in export */
  includeMetadata: boolean;

  /** Generated filename */
  filename: string;

  /** Image quality (PNG only, 1-3) */
  quality?: number;
}

/**
 * Export metadata
 */
export interface ExportMetadata {
  /** Chart title */
  chartTitle: string;

  /** Active timezone */
  timezone: string;

  /** Applied filters */
  filters: ChartFilters;

  /** ISO 8601 timestamp */
  exportDate: string;

  /** Number of data points */
  dataPointCount: number;

  /** Additional component-specific filter labels */
  extraFilters?: Record<string, string>;
}

/**
 * Default chart filters
 */
export const DEFAULT_FILTERS: ChartFilters = {
  timePeriod: "30D",
  tokens: undefined,
  transactionType: "all",
  wallets: undefined,
  customDateRange: undefined,
  timeUnit: "month",
  limit: 2000,
  topN: 1,
};

/**
 * Helper function to validate filters
 */
export function validateFilters(filters: ChartFilters): boolean {
  // If tokens includes 'All', it must be the only element
  if (
    filters.tokens &&
    Array.isArray(filters.tokens) &&
    filters.tokens.includes("All") &&
    filters.tokens.length > 1
  ) {
    return false;
  }

  // If timePeriod is 'custom', customDateRange must be provided
  if (filters.timePeriod === "custom" && !filters.customDateRange) {
    return false;
  }

  // customDateRange.start must be before customDateRange.end
  if (filters.customDateRange) {
    if (filters.customDateRange.start >= filters.customDateRange.end) {
      return false;
    }
  }

  // wallets array must be non-empty if provided
  if (
    filters.wallets !== undefined &&
    Array.isArray(filters.wallets) &&
    filters.wallets.length === 0
  ) {
    return false;
  }

  return true;
}

/**
 * Helper function to check if filters are default
 */
export function isDefaultFilters(filters: ChartFilters): boolean {
  return (
    filters.timePeriod === DEFAULT_FILTERS.timePeriod &&
    (!filters.tokens || filters.tokens.length === 0) &&
    filters.transactionType === DEFAULT_FILTERS.transactionType &&
    filters.wallets === undefined &&
    filters.customDateRange === undefined &&
    filters.limit === DEFAULT_FILTERS.limit
  );
}
