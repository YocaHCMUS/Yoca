/**
 * useFullscreen Hook
 * 
 * Manages fullscreen mode with hybrid native API + modal fallback for iOS compatibility.
 * 
 * @module useFullscreen
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ViewMode } from '../types/chart.types';

/**
 * Hook configuration options
 */
interface UseFullscreenOptions {
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  
  /** Element to make fullscreen (defaults to document.documentElement) */
  element?: HTMLElement;
}

/**
 * Hook return value
 */
interface UseFullscreenReturn {
  /** Current view mode */
  viewMode: ViewMode;
  
  /** Whether fullscreen is supported */
  isSupported: boolean;
  
  /** Whether currently in fullscreen */
  isFullscreen: boolean;
  
  /** Whether currently in mini-player */
  isMiniPlayer: boolean;
  
  /** Enter fullscreen mode */
  enterFullscreen: () => Promise<void>;
  
  /** Exit fullscreen mode */
  exitFullscreen: () => Promise<void>;
  
  /** Toggle fullscreen mode */
  toggleFullscreen: () => Promise<void>;
  
  /** Enter mini-player mode */
  enterMiniPlayer: () => void;
  
  /** Exit mini-player mode */
  exitMiniPlayer: () => void;
  
  /** Toggle mini-player mode */
  toggleMiniPlayer: () => void;
  
  /** Return to normal mode */
  exitAllModes: () => void;
}

/**
 * Check if fullscreen API is supported
 */
function isFullscreenSupported(): boolean {
  return !!(
    document.fullscreenEnabled ||
    (document as any).webkitFullscreenEnabled ||
    (document as any).mozFullScreenEnabled ||
    (document as any).msFullscreenEnabled
  );
}

/**
 * Request fullscreen using the appropriate vendor-prefixed API
 */
async function requestFullscreen(element: HTMLElement): Promise<void> {
  if (element.requestFullscreen) {
    await element.requestFullscreen();
  } else if ((element as any).webkitRequestFullscreen) {
    await (element as any).webkitRequestFullscreen();
  } else if ((element as any).mozRequestFullScreen) {
    await (element as any).mozRequestFullScreen();
  } else if ((element as any).msRequestFullscreen) {
    await (element as any).msRequestFullscreen();
  }
}

/**
 * Exit fullscreen using the appropriate vendor-prefixed API
 */
async function exitFullscreenAPI(): Promise<void> {
  if (document.exitFullscreen) {
    await document.exitFullscreen();
  } else if ((document as any).webkitExitFullscreen) {
    await (document as any).webkitExitFullscreen();
  } else if ((document as any).mozCancelFullScreen) {
    await (document as any).mozCancelFullScreen();
  } else if ((document as any).msExitFullscreen) {
    await (document as any).msExitFullscreen();
  }
}

/**
 * Get current fullscreen element
 */
function getFullscreenElement(): Element | null {
  return (
    document.fullscreenElement ||
    (document as any).webkitFullscreenElement ||
    (document as any).mozFullScreenElement ||
    (document as any).msFullscreenElement ||
    null
  );
}

/**
 * Custom hook for managing fullscreen and mini-player modes
 * 
 * Features:
 * - Native Fullscreen API with vendor prefix support
 * - Modal fallback for iOS Safari
 * - ESC key handler for exiting modes
 * - Mini-player mode for draggable popup
 * 
 * @example
 * ```tsx
 * const {
 *   viewMode,
 *   isFullscreen,
 *   enterFullscreen,
 *   enterMiniPlayer,
 *   exitAllModes
 * } = useFullscreen({
 *   onViewModeChange: (mode) => {
 *     console.log('View mode changed to:', mode);
 *   }
 * });
 * ```
 */
export function useFullscreen(options: UseFullscreenOptions = {}): UseFullscreenReturn {
  const { onViewModeChange, element } = options;
  
  const [viewMode, setViewMode] = useState<ViewMode>('normal');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMiniPlayer = viewMode === 'miniPlayer';
  const isSupported = isFullscreenSupported();
  
  // Store element ref
  const elementRef = useRef<HTMLElement>(element || document.documentElement);
  
  /**
   * Update view mode and notify
   */
  const updateViewMode = useCallback(
    (mode: ViewMode) => {
      setViewMode(mode);
      if (onViewModeChange) {
        onViewModeChange(mode);
      }
    },
    [onViewModeChange]
  );
  
  /**
   * Enter fullscreen mode
   */
  const enterFullscreen = useCallback(async () => {
    try {
      if (isSupported) {
        await requestFullscreen(elementRef.current);
      }
      setIsFullscreen(true);
      updateViewMode('fullscreen');
    } catch (error) {
      console.error('Failed to enter fullscreen:', error);
      // Fallback: update state anyway for modal-based fullscreen
      setIsFullscreen(true);
      updateViewMode('fullscreen');
    }
  }, [isSupported, updateViewMode]);
  
  /**
   * Exit fullscreen mode
   */
  const exitFullscreen = useCallback(async () => {
    try {
      if (isSupported && getFullscreenElement()) {
        await exitFullscreenAPI();
      }
      setIsFullscreen(false);
      updateViewMode('normal');
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      // Fallback: update state anyway
      setIsFullscreen(false);
      updateViewMode('normal');
    }
  }, [isSupported, updateViewMode]);
  
  /**
   * Toggle fullscreen mode
   */
  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else {
      await enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);
  
  /**
   * Enter mini-player mode
   */
  const enterMiniPlayer = useCallback(() => {
    updateViewMode('miniPlayer');
  }, [updateViewMode]);
  
  /**
   * Exit mini-player mode
   */
  const exitMiniPlayer = useCallback(() => {
    updateViewMode('normal');
  }, [updateViewMode]);
  
  /**
   * Toggle mini-player mode
   */
  const toggleMiniPlayer = useCallback(() => {
    if (isMiniPlayer) {
      exitMiniPlayer();
    } else {
      enterMiniPlayer();
    }
  }, [isMiniPlayer, enterMiniPlayer, exitMiniPlayer]);
  
  /**
   * Exit all special modes
   */
  const exitAllModes = useCallback(async () => {
    if (isFullscreen) {
      await exitFullscreen();
    } else if (isMiniPlayer) {
      exitMiniPlayer();
    }
  }, [isFullscreen, isMiniPlayer, exitFullscreen, exitMiniPlayer]);
  
  /**
   * Listen for fullscreen change events
   */
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!getFullscreenElement();
      setIsFullscreen(isNowFullscreen);
      
      if (!isNowFullscreen && viewMode === 'fullscreen') {
        updateViewMode('normal');
      }
    };
    
    // Add listeners for all vendor prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, [viewMode, updateViewMode]);
  
  /**
   * ESC key handler
   */
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        exitAllModes();
      }
    };
    
    if (viewMode !== 'normal') {
      window.addEventListener('keydown', handleEscape);
      
      return () => {
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [viewMode, exitAllModes]);
  
  return {
    viewMode,
    isSupported,
    isFullscreen,
    isMiniPlayer,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    enterMiniPlayer,
    exitMiniPlayer,
    toggleMiniPlayer,
    exitAllModes,
  };
}
