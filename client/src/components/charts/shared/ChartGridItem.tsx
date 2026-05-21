/**
 * ChartGridItem Component
 * 
 * A reusable container component for individual chart instances in a grid layout.
 * Provides consistent styling for borders, padding, aspect ratio, and minimum height.
 * 
 * @module components/charts/shared/ChartGridItem
 */

import React from 'react';

export interface ChartGridItemProps {
  /** Unique identifier for the grid item (optional, for use in grids) */
  itemKey?: string;
  /** Minimum height in pixels */
  minHeight: number;
  /** Aspect ratio for the container (e.g., '1' for square, '16/9' for widescreen) */
  aspectRatio?: string;
  /** The chart component to render inside the container */
  children: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
  /** Additional inline styles */
  style?: React.CSSProperties;
}

/**
 * ChartGridItem - A styled container for individual charts in a grid layout
 * Can also be used for single charts to provide consistent styling
 */
export const ChartGridItem: React.FC<ChartGridItemProps> = ({
  itemKey,
  minHeight,
  aspectRatio,
  children,
  className,
  style,
}) => {
  return (
    <div
      key={itemKey}
      className={className}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: `${minHeight}px`,
        minWidth: 0,
        border: '1px solid var(--cds-border-subtle)',
        borderRadius: '4px',
        padding: '0.5rem',
        ...(aspectRatio && { aspectRatio }),
        ...style,
      }}
    >
      {children}
    </div>
  );
};
