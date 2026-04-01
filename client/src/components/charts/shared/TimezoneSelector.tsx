/**
 * TimezoneSelector Component
 * 
 * Dropdown selector for choosing timezone display preferences.
 * 
 * Features:
 * - Local time zone detection
 * - UTC option
 * - Common timezone shortcuts
 * - Search/filter capability
 * - Integrates with ChartContext
 * 
 * @module components/charts/shared/TimezoneSelector
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useChartContext } from '../../../contexts/ChartContext';
import styles from './TimezoneSelector.module.scss';

/**
 * Common timezones for quick selection
 */
const COMMON_TIMEZONES = [
  { value: 'local', label: 'Local Time', offset: new Date().getTimezoneOffset() },
  { value: 'UTC', label: 'UTC', offset: 0 },
  { value: 'America/New_York', label: 'Eastern Time (ET)', offset: -300 },
  { value: 'America/Chicago', label: 'Central Time (CT)', offset: -360 },
  { value: 'America/Denver', label: 'Mountain Time (MT)', offset: -420 },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: -480 },
  { value: 'Europe/London', label: 'London (GMT)', offset: 0 },
  { value: 'Europe/Paris', label: 'Paris (CET)', offset: 60 },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', offset: 540 },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)', offset: 480 },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)', offset: 660 },
];

export interface TimezoneSelectorProps {
  /** Custom CSS class */
  className?: string;
  
  /** Compact mode (icon only) */
  compact?: boolean;
}

/**
 * TimezoneSelector Component
 * 
 * Allows users to select their preferred timezone for chart data display.
 */
export const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  className,
  compact = false,
}) => {
  const { tr } = useLocalization();
  const { selectedTimezone, setTimezone } = useChartContext();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  /**
   * Get display label for current timezone
   */
  const getCurrentLabel = useCallback(() => {
    const current = COMMON_TIMEZONES.find(tz => tz.value === selectedTimezone);
    return current ? current.label : selectedTimezone;
  }, [selectedTimezone]);
  
  /**
   * Filter timezones based on search query
   */
  const filteredTimezones = COMMON_TIMEZONES.filter(tz =>
    tz.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tz.value.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  /**
   * Handle timezone selection
   */
  const handleSelect = useCallback((timezone: string) => {
    setTimezone(timezone);
    setIsOpen(false);
    setSearchQuery('');
  }, [setTimezone]);
  
  /**
   * Toggle menu visibility
   */
  const toggleMenu = useCallback(() => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      // Focus search input when opening
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);
  
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
        setSearchQuery('');
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
      setSearchQuery('');
      buttonRef.current?.focus();
    }
  }, []);
  
  return (
    <div className={`${styles.timezoneSelector} ${className || ''}`}>
      <button
        ref={buttonRef}
        className={`${styles.triggerButton} ${compact ? styles.compact : ''}`}
        onClick={toggleMenu}
        aria-label={tr('charts.selectTimezone')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        title={`${tr('charts.timezone')}: ${getCurrentLabel()}`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="10" cy="10" r="8" />
          <path d="M10 2v8l4 4" />
        </svg>
        {!compact && (
          <span className={styles.label}>{getCurrentLabel()}</span>
        )}
        <svg
          className={styles.chevron}
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M8 11L3 6h10z" />
        </svg>
      </button>
      
      {isOpen && (
        <div
          ref={menuRef}
          className={styles.menu}
          role="menu"
          aria-label={tr('charts.timezoneOptions')}
          onKeyDown={handleKeyDown}
        >
          <div className={styles.searchContainer}>
            <input
              ref={searchInputRef}
              type="text"
              className={styles.searchInput}
              placeholder={tr('charts.searchTimezones')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={tr('charts.searchTimezones')}
            />
          </div>
          
          <div className={styles.menuItems}>
            {filteredTimezones.length > 0 ? (
              filteredTimezones.map((tz) => (
                <button
                  key={tz.value}
                  className={`${styles.menuItem} ${
                    tz.value === selectedTimezone ? styles.active : ''
                  }`}
                  onClick={() => handleSelect(tz.value)}
                  role="menuitem"
                  tabIndex={0}
                >
                  <span className={styles.tzLabel}>{tz.label}</span>
                  {tz.value === selectedTimezone && (
                    <svg
                      className={styles.checkIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 8 6 11 13 4" />
                    </svg>
                  )}
                </button>
              ))
            ) : (
              <div className={styles.emptyState}>
                {tr('charts.noTimezonesFound')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TimezoneSelector;
