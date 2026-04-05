/**
 * useChartFiltersSync Hook
 * 
 * Synchronizes chart filters with initialFilters prop changes.
 * Eliminates repeated filter syncing logic across chart components.
 * 
 * @module hooks/useChartFiltersSync
 */

import { useEffect, useRef, useMemo } from 'react';
import { useChartFilters } from './useChartFilters';
import type { ChartFilters } from '@/types/chart-filters.types';

interface UseChartFiltersSyncOptions {
  /** Initial filter values */
  initialFilters?: Partial<ChartFilters>;

  /** Debounce delay in milliseconds (default: 300) */
  debounceDelay?: number;

  /** Whether to sync token filters from initialFilters updates */
  syncTokensFromInitialFilters?: boolean;
}

/**
 * Custom hook to synchronize chart filters with prop changes
 * 
 * @param options - Configuration options
 * @returns Filter state and setters with automatic syncing
 * 
 * @example
 * ```tsx
 * const { filters, walletsString, query } = useChartFiltersSync({
 *   initialFilters: props.initialFilters
 * });
 * ```
 */
export function useChartFiltersSync(options: UseChartFiltersSyncOptions = {}) {
  const {
    initialFilters,
    debounceDelay = 300,
    syncTokensFromInitialFilters = true,
  } = options;

  const { filters, setTimePeriod, setWallets, setTokens, isValid, setLimit } = useChartFilters({
    initialFilters,
    debounceDelay,
  });

  // Track previous initialFilters to detect changes
  const prevInitialFiltersRef = useRef<typeof initialFilters | undefined>(undefined);

  /**
   * Sync filters when initialFilters changes
   */
  useEffect(() => {
    const prevFilters = prevInitialFiltersRef.current;

    // Check if wallets changed
    if (initialFilters?.wallets && Array.isArray(initialFilters.wallets)) {
      const prevWallets = Array.isArray(prevFilters?.wallets) ? prevFilters.wallets : [];
      const prevWalletsStr = prevWallets.slice().sort().join(',');
      const newWalletsStr = initialFilters.wallets.slice().sort().join(',');
      if (prevWalletsStr !== newWalletsStr) {
        setWallets(initialFilters.wallets);
      }
    }

    // Check if time period changed
    if (initialFilters?.timePeriod && prevFilters?.timePeriod !== initialFilters.timePeriod) {
      setTimePeriod(initialFilters.timePeriod);
    }

    // Check if tokens changed
    if (syncTokensFromInitialFilters && initialFilters?.tokens && Array.isArray(initialFilters.tokens)) {
      const prevTokens = Array.isArray(prevFilters?.tokens) ? prevFilters.tokens : [];
      const prevTokensStr = prevTokens.slice().sort().join(',');
      const newTokensStr = initialFilters.tokens.slice().sort().join(',');
      if (prevTokensStr !== newTokensStr) {
        setTokens(initialFilters.tokens);
      }
    }

    // Check if limit changed
    if (initialFilters?.limit !== undefined && initialFilters.limit !== prevFilters?.limit) {
      setLimit(initialFilters.limit);
    }

    // Update ref for next comparison
    prevInitialFiltersRef.current = initialFilters;
  }, [initialFilters, setWallets, setTimePeriod, setTokens, setLimit, syncTokensFromInitialFilters]);

  /**
   * Memoize wallets string to prevent unnecessary re-fetches
   */
  const walletsString = useMemo(() => {
    if (!filters.wallets || !Array.isArray(filters.wallets) || filters.wallets.length === 0) {
      return undefined;
    }
    return filters.wallets.slice().sort().join(',');
  }, [filters.wallets]);

  /**
   * Memoize tokens string to prevent unnecessary re-fetches
   */
  const tokensString = useMemo(() => {
    if (!filters.tokens || !Array.isArray(filters.tokens) || filters.tokens.length === 0) {
      return undefined;
    }
    return filters.tokens.slice().sort().join(',');
  }, [filters.tokens]);

  return {
    filters,
    setTimePeriod,
    setWallets,
    setTokens,
    setLimit,
    isValid,
    walletsString,
    tokensString,
  };
}
