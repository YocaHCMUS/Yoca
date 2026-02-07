/**
 * TableWrapper Component
 *
 * Base wrapper component for table components with header, controls, and state management.
 * Supports export functionality similar to chart components.
 *
 * @module components/charts/shared/TableWrapper
 */

import React, { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ExportMenu, type ExportFormat } from './ExportMenu';
import styles from './TableWrapper.module.scss';
import { Tag } from '@carbon/react';

/**
 * Active filter representation
 */
export interface ActiveFilter {
  columnIndex: number;
  columnName: string;
  value: any;
  displayText: string;
}

/**
 * Props for TableWrapper component
 */
interface TableWrapperProps {
  /** Table title */
  title: string;

  /** Table content (rendered when loaded) */
  children: React.ReactNode;

  /** Header actions (custom controls) */
  actions?: React.ReactNode;

  /** Additional class name */
  className?: string;

  /** Enable export functionality (default: true) */
  enableExport?: boolean;

  /** Export callback */
  onExport?: (format: ExportFormat) => Promise<void>;

  /** Whether data is empty */
  isEmpty?: boolean;

  /** Enable search/filter toolbar (default: false) */
  enableToolbar?: boolean;

  /** Search placeholder text */
  searchPlaceholder?: string;

  /** Search value */
  searchValue?: string;

  /** Search change callback */
  onSearchChange?: (value: string) => void;

  /** Active filters to display as tags */
  activeFilters?: ActiveFilter[];

  /** Callback when a filter tag is removed */
  onRemoveFilter?: (columnIndex: number) => void;

  /** Custom toolbar content */
  toolbarContent?: React.ReactNode;
}

/**
 * TableWrapper Component
 *
 * Provides consistent header and export functionality for table components.
 *
 * @example
 * ```tsx
 * <TableWrapper
 *   title="Recent Transactions"
 *   onExport={handleExport}
 * >
 *   <TransactionTable />
 * </TableWrapper>
 * ```
 */
export function TableWrapper({
  title,
  children,
  actions,
  className,
  enableExport = true,
  onExport,
  isEmpty = false,
  enableToolbar = false,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  activeFilters = [],
  onRemoveFilter,
  toolbarContent,
}: TableWrapperProps) {
  const { t } = useTranslation();
  const [isExporting, setIsExporting] = useState(false);

  /**
   * Handle export with loading state
   */
  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!onExport) return;

    setIsExporting(true);
    try {
      await onExport(format);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [onExport]);

  return (
    <div
      className={`${styles.wrapper} ${className || ''}`}
      data-testid="table-wrapper"
      role="region"
      aria-label={`Table: ${title}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title} id={`table-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
          {title}
        </h2>
        <div className={styles.headerActions}>
          {/* Toolbar Search */}
          {enableToolbar && onSearchChange && (
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className={styles.searchInput}
              aria-label="Search table"
            />
          )}

          {/* Custom toolbar content */}
          {toolbarContent}
          {actions}
          {enableExport && onExport && (
            <ExportMenu
              onExport={handleExport}
              isExporting={isExporting}
              disabled={isEmpty}
              formats={['csv']}
            />
          )}
        </div>
      </div>
      {/* Active Filters Display */}

      {/* Content area */}
      <div className={styles.content}>
        {activeFilters.length > 0 && (
          <div className={styles.activeFilters}>
            {activeFilters.map((filter) => (
              <Tag
                key={filter.columnIndex}
                type="blue"
                filter
                onClose={() => onRemoveFilter?.(filter.columnIndex)}
                title={`Filter: ${filter.columnName} = ${filter.displayText}`}
              >
                {filter.columnName}: {filter.displayText}
              </Tag>
            ))}
          </div>

        )}
        {children}
      </div>
    </div>
  );
}