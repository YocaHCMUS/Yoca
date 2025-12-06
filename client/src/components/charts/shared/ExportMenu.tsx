/**
 * ExportMenu Component
 * 
 * Dropdown menu for exporting chart visualizations in multiple formats.
 * 
 * Features:
 * - Export to PNG (retina quality)
 * - Export to SVG (vector format)
 * - Export to CSV (with metadata)
 * - Automatic filename generation
 * - Loading state during export
 * - Error handling
 * 
 * @module components/charts/shared/ExportMenu
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import styles from './ExportMenu.module.scss';

export type ExportFormat = 'png' | 'svg' | 'csv';

export interface ExportMenuProps {
  /** Callback when export is requested */
  onExport: (format: ExportFormat) => Promise<void>;
  
  /** Whether export is in progress */
  isExporting?: boolean;
  
  /** Custom CSS class */
  className?: string;
  
  /** Disabled state */
  disabled?: boolean;
}

/**
 * ExportMenu Component
 * 
 * Provides export functionality for chart visualizations.
 */
export const ExportMenu: React.FC<ExportMenuProps> = ({
  onExport,
  isExporting = false,
  className,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  /**
   * Handle export format selection
   */
  const handleExport = useCallback(async (format: ExportFormat) => {
    setExportingFormat(format);
    setIsOpen(false);
    
    try {
      await onExport(format);
    } catch (error) {
      console.error(`Export to ${format.toUpperCase()} failed:`, error);
    } finally {
      setExportingFormat(null);
    }
  }, [onExport]);
  
  /**
   * Toggle menu visibility
   */
  const toggleMenu = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  }, [disabled, isOpen]);
  
  /**
   * Close menu when clicking outside
   */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current &&
        buttonRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  }, []);
  
  const showLoading = isExporting || exportingFormat !== null;
  
  return (
    <div className={`${styles.exportMenu} ${className || ''}`}>
      <button
        ref={buttonRef}
        className={styles.triggerButton}
        onClick={toggleMenu}
        disabled={disabled || showLoading}
        aria-label="Export chart"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title="Export chart"
      >
        {showLoading ? (
          <svg
            className={styles.spinner}
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="10" cy="10" r="8" opacity="0.25" />
            <path d="M10 2 A8 8 0 0 1 18 10" strokeLinecap="round">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 10 10"
                to="360 10 10"
                dur="1s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 17v2h14v-2" />
            <path d="M10 3v11" />
            <polyline points="6 10 10 14 14 10" />
          </svg>
        )}
        <span className={styles.buttonText}>Export</span>
      </button>
      
      {isOpen && !showLoading && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label="Export format options"
          onKeyDown={handleKeyDown}
        >
          <button
            className={styles.menuItem}
            onClick={() => handleExport('png')}
            role="menuitem"
            tabIndex={0}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" />
              <circle cx="6" cy="6" r="1.5" />
              <polyline points="12 10 9 7 2 14" />
            </svg>
            <span>Export as PNG</span>
            <span className={styles.badge}>Retina</span>
          </button>
          
          <button
            className={styles.menuItem}
            onClick={() => handleExport('svg')}
            role="menuitem"
            tabIndex={0}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M2 2 L8 2 L14 8 L14 14 L2 14 Z" />
              <polyline points="8 2 8 8 14 8" />
            </svg>
            <span>Export as SVG</span>
            <span className={styles.badge}>Vector</span>
          </button>
          
          <button
            className={styles.menuItem}
            onClick={() => handleExport('csv')}
            role="menuitem"
            tabIndex={0}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="2" width="12" height="12" rx="1" />
              <line x1="5" y1="2" x2="5" y2="14" />
              <line x1="11" y1="2" x2="11" y2="14" />
              <line x1="2" y1="6" x2="14" y2="6" />
              <line x1="2" y1="10" x2="14" y2="10" />
            </svg>
            <span>Export as CSV</span>
            <span className={styles.badge}>Data</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
