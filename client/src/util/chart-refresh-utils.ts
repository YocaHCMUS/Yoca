/**
 * Chart Auto-Refresh Utilities
 * 
 * Provides utilities for managing auto-refresh behavior across multiple charts,
 * including staggered refresh offsets to prevent simultaneous API calls.
 * 
 * @module chart-refresh-utils
 */

/**
 * Calculate staggered refresh offsets for multiple charts
 * 
 * Distributes refresh timings evenly across the refresh interval to prevent
 * all charts from refreshing simultaneously and overwhelming the server.
 * 
 * @param chartCount - Number of charts that will auto-refresh
 * @param refreshInterval - Total refresh interval in milliseconds (default: 30000)
 * @returns Array of offset values in milliseconds, one per chart
 * 
 * @example
 * ```typescript
 * const offsets = calculateStaggeredOffsets(8, 30000);
 * // Returns: [0, 3750, 7500, 11250, 15000, 18750, 22500, 26250]
 * // Charts will refresh 3.75s apart within a 30s cycle
 * ```
 */
export function calculateStaggeredOffsets(
  chartCount: number,
  refreshInterval: number = 30000
): number[] {
  if (chartCount <= 0) {
    return [];
  }
  
  if (chartCount === 1) {
    return [0];
  }
  
  // Calculate the time gap between each chart's refresh
  const staggerGap = refreshInterval / chartCount;
  
  // Generate offsets
  const offsets: number[] = [];
  for (let i = 0; i < chartCount; i++) {
    offsets.push(Math.round(i * staggerGap));
  }
  
  return offsets;
}

/**
 * Calculate a random offset within a range
 * 
 * Useful for adding jitter to prevent synchronized refreshes across different user sessions.
 * 
 * @param maxOffset - Maximum offset in milliseconds (default: 5000)
 * @returns Random offset between 0 and maxOffset
 * 
 * @example
 * ```typescript
 * const jitter = calculateRandomOffset(5000);
 * // Returns a random value between 0 and 5000ms
 * ```
 */
export function calculateRandomOffset(maxOffset: number = 5000): number {
  return Math.floor(Math.random() * maxOffset);
}

/**
 * Calculate hybrid staggered offsets with random jitter
 * 
 * Combines even distribution with random jitter for optimal load balancing
 * both within a single page and across multiple user sessions.
 * 
 * @param chartCount - Number of charts that will auto-refresh
 * @param refreshInterval - Total refresh interval in milliseconds (default: 30000)
 * @param jitterRange - Maximum random jitter in milliseconds (default: 1000)
 * @returns Array of offset values with jitter applied
 * 
 * @example
 * ```typescript
 * const offsets = calculateHybridOffsets(4, 30000, 1000);
 * // Base: [0, 7500, 15000, 22500]
 * // With jitter: [342, 7891, 15234, 22678]
 * ```
 */
export function calculateHybridOffsets(
  chartCount: number,
  refreshInterval: number = 30000,
  jitterRange: number = 1000
): number[] {
  const baseOffsets = calculateStaggeredOffsets(chartCount, refreshInterval);
  
  return baseOffsets.map((offset, index) => {
    // First chart has no jitter to start immediately
    if (index === 0) {
      return offset;
    }
    
    // Add random jitter to subsequent charts
    const jitter = Math.floor(Math.random() * jitterRange);
    return offset + jitter;
  });
}

/**
 * Format offset for debugging
 * 
 * @param offsetMs - Offset in milliseconds
 * @returns Human-readable string (e.g., "3.75s")
 */
export function formatOffset(offsetMs: number): string {
  const seconds = offsetMs / 1000;
  return `${seconds.toFixed(2)}s`;
}

/**
 * Validate refresh configuration
 * 
 * Ensures refresh interval and offsets are within reasonable bounds.
 * 
 * @param interval - Refresh interval in milliseconds
 * @param offsets - Array of stagger offsets
 * @returns True if valid, throws error if invalid
 */
export function validateRefreshConfig(
  interval: number,
  offsets: number[]
): boolean {
  if (interval < 5000) {
    throw new Error('Refresh interval must be at least 5 seconds');
  }
  
  if (interval > 300000) {
    throw new Error('Refresh interval must be less than 5 minutes');
  }
  
  for (const offset of offsets) {
    if (offset < 0 || offset >= interval) {
      throw new Error(`Offset ${offset}ms is out of bounds for interval ${interval}ms`);
    }
  }
  
  return true;
}

/**
 * Calculate optimal refresh interval based on chart count
 * 
 * Adjusts refresh interval to ensure adequate spacing between chart updates.
 * 
 * @param chartCount - Number of charts
 * @param minGapMs - Minimum gap between refreshes (default: 2000ms)
 * @returns Recommended refresh interval in milliseconds
 */
export function calculateOptimalInterval(
  chartCount: number,
  minGapMs: number = 2000
): number {
  const baseInterval = 30000; // 30 seconds default
  const requiredInterval = chartCount * minGapMs;
  
  // Return the larger of base interval or required interval
  return Math.max(baseInterval, requiredInterval);
}
