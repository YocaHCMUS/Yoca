/**
 * useChartFilters Hook
 * 
 * Manages chart filter state with debounced updates to prevent excessive API calls.
 * 
 * @module useChartFilters
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import debounce from 'lodash.debounce';
import type { ChartFilters, TimePeriod, TransactionType, DateRange } from '../types/chart-filters.types';
import { DEFAULT_FILTERS, validateFilters } from '../types/chart-filters.types';

/**
 * Hook configuration options
 */
interface UseChartFiltersOptions {
  /** Initial filter state */
  initialFilters?: Partial<ChartFilters>;
  
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceDelay?: number;
  
  /** Callback when filters change (after debounce) */
  onFiltersChange?: (filters: ChartFilters) => void;
}

/**
 * Hook return value
 */
interface UseChartFiltersReturn {
  /** Current filter state */
  filters: ChartFilters;
  
  /** Immediate filter state (before debounce) */
  immediateFilters: ChartFilters;
  
  /** Update time period filter */
  setTimePeriod: (period: TimePeriod) => void;
  
  /** Update tokens filter */
  setTokens: (tokens: string[]) => void;
  
  /** Update transaction type filter */
  setTransactionType: (type: TransactionType) => void;
  
  /** Update wallets filter */
  setWallets: (wallets: string[] | undefined) => void;
  
  /** Update custom date range */
  setCustomDateRange: (range: DateRange | undefined) => void;
  
  /** Reset filters to default */
  resetFilters: () => void;
  
  /** Check if filters are valid */
  isValid: boolean;
  
  /** Check if filters are loading (debouncing) */
  isDebouncing: boolean;
}

/**
 * Custom hook for managing chart filters with debounced updates
 * 
 * @example
 * ```tsx
 * const {
 *   filters,
 *   setTimePeriod,
 *   setTokens,
 *   resetFilters,
 *   isValid
 * } = useChartFilters({
 *   debounceDelay: 300,
 *   onFiltersChange: (filters) => {
 *     fetchChartData(filters);
 *   }
 * });
 * ```
 */
export function useChartFilters(options: UseChartFiltersOptions = {}): UseChartFiltersReturn {
  const {
    initialFilters = {},
    debounceDelay = 300,
    onFiltersChange,
  } = options;
  
  // Merge initial filters with defaults
  const mergedInitialFilters: ChartFilters = {
    ...DEFAULT_FILTERS,
    ...initialFilters,
  };
  
  // Immediate filter state (updates instantly)
  const [immediateFilters, setImmediateFilters] = useState<ChartFilters>(mergedInitialFilters);
  
  // Debounced filter state (updates after delay)
  const [filters, setFilters] = useState<ChartFilters>(mergedInitialFilters);
  
  // Track if debouncing is in progress
  const [isDebouncing, setIsDebouncing] = useState(false);
  
  // Validate filters
  const isValid = validateFilters(immediateFilters);
  
  // Create debounced update function
  const debouncedUpdate = useRef(
    debounce((newFilters: ChartFilters) => {
      setFilters(newFilters);
      setIsDebouncing(false);
      
      if (onFiltersChange) {
        onFiltersChange(newFilters);
      }
    }, debounceDelay)
  ).current;
  
  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedUpdate.cancel();
    };
  }, [debouncedUpdate]);
  
  // Generic update function
  const updateFilter = useCallback(
    (updates: Partial<ChartFilters>) => {
      const newFilters = { ...immediateFilters, ...updates };
      setImmediateFilters(newFilters);
      setIsDebouncing(true);
      debouncedUpdate(newFilters);
    },
    [immediateFilters, debouncedUpdate]
  );
  
  // Specific update functions
  const setTimePeriod = useCallback(
    (period: TimePeriod) => {
      updateFilter({
        timePeriod: period,
        // Clear custom date range if switching away from custom
        customDateRange: period === 'custom' ? immediateFilters.customDateRange : undefined,
      });
    },
    [updateFilter, immediateFilters.customDateRange]
  );
  
  const setTokens = useCallback(
    (tokens: string[]) => {
      updateFilter({ tokens });
    },
    [updateFilter]
  );
  
  const setTransactionType = useCallback(
    (type: TransactionType) => {
      updateFilter({ transactionType: type });
    },
    [updateFilter]
  );
  
  const setWallets = useCallback(
    (wallets: string[] | undefined) => {
      updateFilter({ wallets });
    },
    [updateFilter]
  );
  
  const setCustomDateRange = useCallback(
    (range: DateRange | undefined) => {
      updateFilter({
        customDateRange: range,
        // Automatically switch to custom time period if range is provided
        timePeriod: range ? 'custom' : immediateFilters.timePeriod,
      });
    },
    [updateFilter, immediateFilters.timePeriod]
  );
  
  const resetFilters = useCallback(() => {
    setImmediateFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setIsDebouncing(false);
    debouncedUpdate.cancel();
    
    if (onFiltersChange) {
      onFiltersChange(DEFAULT_FILTERS);
    }
  }, [debouncedUpdate, onFiltersChange]);
  
  return {
    filters,
    immediateFilters,
    setTimePeriod,
    setTokens,
    setTransactionType,
    setWallets,
    setCustomDateRange,
    resetFilters,
    isValid,
    isDebouncing,
  };
}
