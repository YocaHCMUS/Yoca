/**
 * Chart Helper Utilities
 * 
 * Common utility functions for chart components including formatting,
 * date handling, and data processing.
 * 
 * @module chart-helpers
 */

import { format, formatDistanceToNow } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { TimePeriod } from '../types/chart-filters.types';

/**
 * Format currency value with appropriate precision and units
 * 
 * @example
 * formatCurrency(1234567.89) // "$1.23M"
 * formatCurrency(123.45) // "$123.45"
 */
export function formatCurrency(value: number, _currency: string = 'USD'): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  // Format large numbers with K, M, B suffixes
  if (absValue >= 1_000_000_000) {
    return `${sign}$${(absValue / 1_000_000_000).toFixed(2)}B`;
  } else if (absValue >= 1_000_000) {
    return `${sign}$${(absValue / 1_000_000).toFixed(2)}M`;
  } else if (absValue >= 1_000) {
    return `${sign}$${(absValue / 1_000).toFixed(2)}K`;
  } else {
    return `${sign}$${absValue.toFixed(2)}`;
  }
}

/**
 * Format percentage value
 * 
 * @example
 * formatPercentage(0.1234) // "12.34%"
 * formatPercentage(0.5) // "50.00%"
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format number with thousands separators
 * 
 * @example
 * formatNumber(1234567) // "1,234,567"
 * formatNumber(123.456, 2) // "123.46"
 */
export function formatNumber(value: number, decimals?: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format date with timezone support
 * 
 * @example
 * formatDate(new Date(), 'America/New_York') // "Dec 3, 2025"
 * formatDate(timestamp, 'UTC', 'yyyy-MM-dd') // "2025-12-03"
 */
export function formatDate(
  date: Date | number,
  timezone: string = 'UTC',
  formatStr: string = 'MMM d, yyyy'
): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  
  try {
    return formatInTimeZone(dateObj, timezone, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return format(dateObj, formatStr);
  }
}

/**
 * Format timestamp with time and timezone support
 * 
 * @example
 * formatTimestamp(timestamp, 'America/New_York') // "Dec 3, 2025 10:30 AM EST"
 */
export function formatTimestamp(
  timestamp: number,
  timezone: string = 'UTC',
  includeSeconds: boolean = false
): string {
  const formatStr = includeSeconds
    ? 'MMM d, yyyy h:mm:ss a zzz'
    : 'MMM d, yyyy h:mm a zzz';
  
  return formatDate(timestamp, timezone, formatStr);
}

/**
 * Format relative time (e.g., "2 hours ago")
 * 
 * @example
 * formatRelativeTime(new Date(Date.now() - 3600000)) // "about 1 hour ago"
 */
export function formatRelativeTime(date: Date | number): string {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  return formatDistanceToNow(dateObj, { addSuffix: true });
}

/**
 * Generate filename for chart export following convention:
 * data_name-filters-timestamp.ext
 * 
 * @example
 * generateFilename('balance', { timePeriod: '30D', tokens: ['BTC'] }, 'png')
 * // "balance-30D-BTC-2025-12-03T10-30-15.png"
 */
export function generateFilename(
  baseName: string,
  filters: { timePeriod: string; tokens: string[] },
  extension: string
): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, -5); // Remove milliseconds and Z
  
  const filterParts = [
    filters.timePeriod,
    filters.tokens.join(','),
  ].filter(Boolean);
  
  const filterStr = filterParts.join('-');
  return `${baseName}-${filterStr}-${timestamp}.${extension}`;
}

/**
 * Estimate number of data points based on time period
 * Used to determine aggregation level
 * 
 * @example
 * estimateDataPoints('7D', 'hourly') // 168 (7 days * 24 hours)
 * estimateDataPoints('1Y', 'daily') // 365
 */
export function estimateDataPoints(
  timePeriod: TimePeriod,
  granularity: 'hourly' | 'daily' | 'weekly' | 'monthly' = 'daily'
): number {
  const hoursPerUnit = {
    hourly: 1,
    daily: 24,
    weekly: 24 * 7,
    monthly: 24 * 30,
  };
  
  const hours = {
    '7D': 7 * 24,
    '30D': 30 * 24,
    '60D': 60 * 24,
    '90D': 90 * 24,
    '1Y': 365 * 24,
    'All': 730 * 24, // Assume 2 years max
    'custom': 30 * 24, // Default to 30 days
  };
  
  return Math.ceil(hours[timePeriod] / hoursPerUnit[granularity]);
}

/**
 * Determine optimal aggregation level based on time period and max points
 * 
 * @example
 * getOptimalAggregation('1Y', 1000) // 'daily'
 * getOptimalAggregation('7D', 1000) // 'hourly'
 */
export function getOptimalAggregation(
  timePeriod: TimePeriod,
  maxPoints: number = 2000
): 'hourly' | 'daily' | 'weekly' | 'monthly' {
  const granularities: Array<'hourly' | 'daily' | 'weekly' | 'monthly'> = [
    'hourly',
    'daily',
    'weekly',
    'monthly',
  ];
  
  for (const granularity of granularities) {
    const points = estimateDataPoints(timePeriod, granularity);
    if (points <= maxPoints) {
      return granularity;
    }
  }
  
  return 'monthly';
}

/**
 * Calculate stagger offset for auto-refresh to prevent simultaneous requests
 * Based on chart ID hash
 * 
 * @example
 * calculateStaggerOffset('chart-1') // 1234 (ms)
 */
export function calculateStaggerOffset(chartId: string, maxOffset: number = 5000): number {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < chartId.length; i++) {
    const char = chartId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Map to 0-maxOffset range
  return Math.abs(hash) % maxOffset;
}

/**
 * Truncate text with ellipsis
 * 
 * @example
 * truncateText('Very long text that needs truncation', 20)
 * // "Very long text th..."
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Get color from palette by index (with wrapping)
 * 
 * @example
 * getColorFromPalette(0, colors) // colors[0]
 * getColorFromPalette(15, colors) // colors[15 % colors.length]
 */
export function getColorFromPalette(index: number, palette: string[]): string {
  return palette[index % palette.length];
}

/**
 * Validate if timezone string is valid IANA timezone
 * 
 * @example
 * isValidTimezone('America/New_York') // true
 * isValidTimezone('Invalid/Timezone') // false
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Chart helper utilities object
 */
export const chartHelpers = {
  formatCurrency,
  formatPercentage,
  formatNumber,
  formatDate,
  formatTimestamp,
  formatRelativeTime,
  generateFilename,
  estimateDataPoints,
  getOptimalAggregation,
  calculateStaggerOffset,
  truncateText,
  getColorFromPalette,
  isValidTimezone,
};
