/**
 * useAutoRefresh Hook
 * 
 * Manages automatic data refresh with pause detection for user interaction and tab visibility.
 * 
 * @module useAutoRefresh
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type { AutoRefreshConfig } from '../types/chart.types';
import { DEFAULT_AUTO_REFRESH } from '../types/chart.types';

/**
 * Hook configuration options
 */
interface UseAutoRefreshOptions {
  /** Refresh callback function */
  onRefresh: () => Promise<void> | void;
  
  /** Initial configuration */
  config?: Partial<AutoRefreshConfig>;
  
  /** Enable/disable the auto-refresh */
  enabled?: boolean;
}

/**
 * Hook return value
 */
interface UseAutoRefreshReturn {
  /** Current auto-refresh configuration */
  config: AutoRefreshConfig;
  
  /** Whether auto-refresh is currently active */
  isActive: boolean;
  
  /** Whether refresh is currently in progress */
  isRefreshing: boolean;
  
  /** Timestamp of last successful refresh */
  lastRefresh: Date | undefined;
  
  /** Manually trigger a refresh */
  refresh: () => Promise<void>;
  
  /** Pause auto-refresh */
  pause: () => void;
  
  /** Resume auto-refresh */
  resume: () => void;
  
  /** Update auto-refresh configuration */
  updateConfig: (config: Partial<AutoRefreshConfig>) => void;
}

/**
 * Custom hook for managing auto-refresh with pause detection
 * 
 * Features:
 * - 30-second interval (configurable)
 * - Pauses when tab is hidden (Page Visibility API)
 * - Pauses during user interaction (mouse/scroll events)
 * - Stagger offset to prevent simultaneous refreshes
 * 
 * @example
 * ```tsx
 * const { isActive, isRefreshing, lastRefresh, refresh } = useAutoRefresh({
 *   onRefresh: async () => {
 *     await fetchChartData();
 *   },
 *   config: {
 *     interval: 30000,
 *     pauseOnInteraction: true,
 *   },
 * });
 * ```
 */
export function useAutoRefresh(options: UseAutoRefreshOptions): UseAutoRefreshReturn {
  const { onRefresh, config: initialConfig, enabled = true } = options;
  
  // Merge config with defaults
  const [config, setConfig] = useState<AutoRefreshConfig>({
    ...DEFAULT_AUTO_REFRESH,
    ...initialConfig,
    enabled: enabled && (initialConfig?.enabled ?? DEFAULT_AUTO_REFRESH.enabled),
  });
  
  // Track refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | undefined>(config.lastRefresh);
  
  // Track if tab is visible
  const [isTabVisible, setIsTabVisible] = useState(!document.hidden);
  
  // Track if user is interacting
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Calculate if auto-refresh is active
  const isActive =
    config.enabled &&
    isTabVisible &&
    (!config.pauseOnInteraction || !isUserInteracting);
  
  /**
   * Handle visibility change
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  /**
   * Handle user interaction detection
   */
  useEffect(() => {
    if (!config.pauseOnInteraction) {
      return;
    }
    
    const handleInteraction = () => {
      setIsUserInteracting(true);
      
      // Clear existing timeout
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
      
      // Set new timeout to resume after 2 seconds of inactivity
      interactionTimeoutRef.current = setTimeout(() => {
        setIsUserInteracting(false);
      }, 2000);
    };
    
    // Listen for user interactions
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });
    
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleInteraction);
      });
      
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, [config.pauseOnInteraction]);
  
  /**
   * Manual refresh function
   */
  const refresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }
    
    setIsRefreshing(true);
    
    try {
      await onRefresh();
      const now = new Date();
      setLastRefresh(now);
      setConfig((prev) => ({ ...prev, lastRefresh: now }));
    } catch (error) {
      console.error('Auto-refresh error:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, onRefresh]);
  
  /**
   * Setup auto-refresh timer
   */
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Don't start timer if not active
    if (!isActive) {
      return;
    }
    
    // Calculate initial delay with stagger offset
    const initialDelay = config.staggerOffset ?? 0;
    
    // Start timer after initial delay
    const startTimer = () => {
      timerRef.current = setInterval(() => {
        if (isActive && !isRefreshing) {
          refresh();
        }
      }, config.interval);
    };
    
    if (initialDelay > 0) {
      const timeout = setTimeout(startTimer, initialDelay);
      return () => clearTimeout(timeout);
    } else {
      startTimer();
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive, config.interval, config.staggerOffset, isRefreshing, refresh]);
  
  /**
   * Pause auto-refresh
   */
  const pause = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: false }));
  }, []);
  
  /**
   * Resume auto-refresh
   */
  const resume = useCallback(() => {
    setConfig((prev) => ({ ...prev, enabled: true }));
  }, []);
  
  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig: Partial<AutoRefreshConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);
  
  return {
    config,
    isActive,
    isRefreshing,
    lastRefresh,
    refresh,
    pause,
    resume,
    updateConfig,
  };
}
