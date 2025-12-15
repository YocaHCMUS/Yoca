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
import { useTranslation } from 'react-i18next';
import styles from './ExportMenu.module.scss';
import { Download, Image, Svg, Table } from '@carbon/icons-react';

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
  const { t } = useTranslation();
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
        aria-label={t('charts.exportChart')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={t('charts.exportChart')}
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
          <Download size={20} />
        )}
        <span className={styles.buttonText}>{t('charts.export')}</span>
      </button>
      
      {isOpen && !showLoading && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label={t('charts.exportFormatOptions')}
          onKeyDown={handleKeyDown}
        >
          <button
            className={styles.menuItem}
            onClick={() => handleExport('png')}
            role="menuitem"
            tabIndex={0}
          >
            <Image size={16} />
            <span>{t('charts.exportPNG')}</span>
            <span className={styles.badge}>{t('charts.retinaBadge')}</span>
          </button>
          
          <button
            className={styles.menuItem}
            onClick={() => handleExport('svg')}
            role="menuitem"
            tabIndex={0}
          >
            <Svg size={16} />
            <span>{t('charts.exportSVG')}</span>
            <span className={styles.badge}>{t('charts.vectorBadge')}</span>
          </button>
          
          <button
            className={styles.menuItem}
            onClick={() => handleExport('csv')}
            role="menuitem"
            tabIndex={0}
          >
            <Table size={16} />
            <span>{t('charts.exportCSV')}</span>
            <span className={styles.badge}>{t('charts.dataBadge')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportMenu;
