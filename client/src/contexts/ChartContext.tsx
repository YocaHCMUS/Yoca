/**
 * Chart Context
 * 
 * Provides shared state for charts across the application, including:
 * - Global timezone setting
 * - Chart registration for coordinated refreshes
 * - Shared configuration
 * 
 * @module ChartContext
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

/**
 * Type for chart refresh function
 */
type ChartRefreshFn = () => Promise<void>;

/**
 * Chart context value interface
 */
interface ChartContextValue {
  /** Currently selected timezone (IANA timezone string) */
  selectedTimezone: string;
  
  /** Update the global timezone setting */
  setTimezone: (tz: string) => void;
  
  /** Register a chart for coordinated refresh */
  registerChart: (chartId: string, refreshFn: ChartRefreshFn) => void;
  
  /** Unregister a chart */
  unregisterChart: (chartId: string) => void;
  
  /** Refresh all registered charts */
  refreshAllCharts: () => Promise<void>;
  
  /** Check if a chart is registered */
  isChartRegistered: (chartId: string) => boolean;
}

/**
 * Create the context with undefined default
 */
const ChartContext = createContext<ChartContextValue | undefined>(undefined);

/**
 * Hook to access the chart context
 * @throws Error if used outside of ChartProvider
 */
export function useChartContext(): ChartContextValue {
  const context = useContext(ChartContext);
  
  if (!context) {
    throw new Error('useChartContext must be used within a ChartProvider');
  }
  
  return context;
}

/**
 * Props for ChartProvider component
 */
interface ChartProviderProps {
  /** Child components */
  children: React.ReactNode;
  
  /** Initial timezone (defaults to user's local timezone) */
  initialTimezone?: string;
}

/**
 * ChartProvider Component
 * 
 * Wraps the application or a section of the app to provide shared chart state.
 * 
 * @example
 * ```tsx
 * <ChartProvider initialTimezone="America/New_York">
 *   <Dashboard />
 * </ChartProvider>
 * ```
 */
export function ChartProvider({ children, initialTimezone }: ChartProviderProps) {
  // Get user's local timezone if not specified
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [selectedTimezone, setSelectedTimezone] = useState<string>(
    initialTimezone || userTimezone
  );
  
  // Registry of chart refresh functions
  const chartRegistry = useRef<Map<string, ChartRefreshFn>>(new Map());
  
  /**
   * Update the global timezone
   */
  const setTimezone = useCallback((tz: string) => {
    setSelectedTimezone(tz);
  }, []);
  
  /**
   * Register a chart with its refresh function
   */
  const registerChart = useCallback((chartId: string, refreshFn: ChartRefreshFn) => {
    chartRegistry.current.set(chartId, refreshFn);
  }, []);
  
  /**
   * Unregister a chart
   */
  const unregisterChart = useCallback((chartId: string) => {
    chartRegistry.current.delete(chartId);
  }, []);
  
  /**
   * Refresh all registered charts
   */
  const refreshAllCharts = useCallback(async () => {
    const refreshPromises: Promise<void>[] = [];
    
    chartRegistry.current.forEach((refreshFn) => {
      refreshPromises.push(refreshFn());
    });
    
    try {
      await Promise.all(refreshPromises);
    } catch (error) {
      console.error('Error refreshing charts:', error);
    }
  }, []);
  
  /**
   * Check if a chart is registered
   */
  const isChartRegistered = useCallback((chartId: string) => {
    return chartRegistry.current.has(chartId);
  }, []);
  
  const value: ChartContextValue = {
    selectedTimezone,
    setTimezone,
    registerChart,
    unregisterChart,
    refreshAllCharts,
    isChartRegistered,
  };
  
  return <ChartContext.Provider value={value}>{children}</ChartContext.Provider>;
}

/**
 * Re-export context for direct access if needed
 */
export { ChartContext };
