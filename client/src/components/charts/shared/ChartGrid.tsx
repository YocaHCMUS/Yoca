/**
 * ChartGrid Component
 * 
 * A reusable grid container for displaying multiple chart instances.
 * Automatically adapts grid columns based on the number of items.
 * 
 * @module components/charts/shared/ChartGrid
 */

import React from 'react';

export interface ChartGridProps {
  /** Number of items in the grid */
  itemCount: number;
  /** Number of columns to use when displaying multiple items (ignored if autoFit is true) */
  multiItemColumns?: number;
  /** Use auto-fit with minmax for responsive layout */
  autoFit?: boolean;
  /** Minimum column width when using auto-fit (default: 400px) */
  minColumnWidth?: string;
  /** Gap between grid items */
  gap?: string;
  /** The chart items to render in the grid */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * ChartGrid - A responsive grid container for multiple chart instances
 */
export const ChartGrid: React.FC<ChartGridProps> = ({
  itemCount,
  multiItemColumns = 3,
  autoFit = false,
  minColumnWidth = '400px',
  gap = '0',
  children,
  className,
  style,
}) => {
  const gridTemplateColumns = autoFit
    ? `repeat(auto-fit, minmax(${minColumnWidth}, 1fr))`
    : itemCount > 1 
      ? `repeat(${multiItemColumns}, 1fr)` 
      : '1fr';

  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns,
        gap,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
