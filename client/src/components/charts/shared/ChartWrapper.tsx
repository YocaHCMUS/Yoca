/**
 * ChartWrapper Component
 * 
 * Base wrapper component for all chart types with header, controls, and state management.
 * Supports keyboard navigation: F for fullscreen, M for mini-player, ESC to exit modes.
 * 
 * @module ChartWrapper
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { ChartSkeleton } from './ChartSkeleton';
import { ChartEmptyState } from './ChartEmptyState';
import { ChartErrorState } from './ChartErrorState';
import { ExportMenu, type ExportFormat } from './ExportMenu';
import { FullscreenView } from './FullscreenView';
import { MiniPlayer } from './MiniPlayer';
import type { ChartLoadingState } from '../../../types/chart.types';
import styles from './ChartWrapper.module.scss';

/**
 * Props for ChartWrapper component
 */
interface ChartWrapperProps {
  /** Chart title */
  title: string;
  
  /** Loading state */
  loadingState: ChartLoadingState;
  
  /** Chart content (rendered when loaded) */
  children: React.ReactNode;
  
  /** Header actions (custom controls) */
  actions?: React.ReactNode;
  
  /** Chart height */
  height?: number;
  
  /** Show legend skeleton in loading state */
  showLegend?: boolean;
  
  /** Retry callback for error state */
  onRetry?: () => void;
  
  /** Empty state configuration */
  emptyState?: {
    title?: string;
    message?: string;
    action?: {
      label: string;
      onClick: () => void;
    };
  };
  
  /** Additional class name */
  className?: string;
  
  /** Whether data is empty */
  isEmpty?: boolean;
  
  /** Enable export functionality (default: true) */
  enableExport?: boolean;
  
  /** Export callback */
  onExport?: (format: ExportFormat) => Promise<void>;
  
  /** Enable fullscreen mode (default: true) */
  enableFullscreen?: boolean;
  
  /** Enable mini-player mode (default: true) */
  enableMiniPlayer?: boolean;
}

/**
 * ChartWrapper Component
 * 
 * Provides consistent header, loading states, error handling, and empty states for all charts.
 * Includes export, fullscreen, and mini-player functionality.
 * 
 * @example
 * ```tsx
 * <ChartWrapper
 *   title="Balance Trend"
 *   loadingState={loadingState}
 *   onExport={handleExport}
 *   height={400}
 *   onRetry={fetchData}
 *   isEmpty={data.length === 0}
 * >
 *   <ReactECharts option={chartOption} />
 * </ChartWrapper>
 * ```
 */
export function ChartWrapper({
  title,
  loadingState,
  children,
  actions,
  height = 400,
  showLegend = true,
  onRetry,
  emptyState,
  className,
  isEmpty = false,
  enableExport = true,
  onExport,
  enableFullscreen = true,
  enableMiniPlayer = true,
}: ChartWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMiniPlayer, setIsMiniPlayer] = useState(false);
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
  
  /**
   * Enter fullscreen mode
   */
  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setIsMiniPlayer(false);
  }, []);
  
  /**
   * Exit fullscreen mode
   */
  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
  }, []);
  
  /**
   * Enter mini-player mode
   */
  const enterMiniPlayer = useCallback(() => {
    setIsMiniPlayer(true);
    setIsFullscreen(false);
  }, []);
  
  /**
   * Exit mini-player mode
   */
  const exitMiniPlayer = useCallback(() => {
    setIsMiniPlayer(false);
  }, []);
  
  /**
   * Handle keyboard shortcuts
   * F: Fullscreen, M: Mini-player, ESC: Exit modes
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      switch (event.key.toLowerCase()) {
        case 'f':
          if (enableFullscreen && !isFullscreen && !isMiniPlayer) {
            event.preventDefault();
            enterFullscreen();
          }
          break;
        case 'm':
          if (enableMiniPlayer && !isFullscreen && !isMiniPlayer) {
            event.preventDefault();
            enterMiniPlayer();
          }
          break;
        case 'escape':
          if (isFullscreen) {
            event.preventDefault();
            exitFullscreen();
          } else if (isMiniPlayer) {
            event.preventDefault();
            exitMiniPlayer();
          }
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enableFullscreen, enableMiniPlayer, isFullscreen, isMiniPlayer, enterFullscreen, enterMiniPlayer, exitFullscreen, exitMiniPlayer]);
  
  /**
   * Render viewing mode controls
   */
  const renderControls = () => (
    <div className={styles.controls} role="toolbar" aria-label="Chart viewing modes">
      {enableFullscreen && (
        <button
          className={styles.controlButton}
          onClick={enterFullscreen}
          aria-label="Enter fullscreen mode (press F)"
          title="Fullscreen (F)"
          disabled={loadingState.status === 'loading'}
          tabIndex={0}
        >
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
            <path d="M3 3h5v2H5v3H3V3zm9 0h5v5h-2V5h-3V3zM8 15H5v-3H3v5h5v-2zm9-3v3h-3v2h5v-5h-2z" />
          </svg>
        </button>
      )}
      
      {enableMiniPlayer && (
        <button
          className={styles.controlButton}
          onClick={enterMiniPlayer}
          aria-label="Open mini player (press M)"
          title="Mini player (M)"
          disabled={loadingState.status === 'loading'}
          tabIndex={0}
        >
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
            <rect x="3" y="7" width="14" height="10" rx="1" />
            <path d="M6 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      )}
    </div>
  );
  
  /**
   * Render chart content area
   */
  const renderContent = () => (
    <>
      {/* Loading state */}
      {loadingState.status === 'loading' && (
        <ChartSkeleton
          height={height}
          showHeader={false}
          showLegend={showLegend}
        />
      )}
      
      {/* Error state */}
      {loadingState.status === 'error' && loadingState.error && (
        <ChartErrorState
          error={loadingState.error}
          onRetry={onRetry}
          height={height}
        />
      )}
      
      {/* Empty state */}
      {loadingState.status === 'success' && isEmpty && (
        <ChartEmptyState
          title={emptyState?.title}
          message={emptyState?.message}
          action={emptyState?.action}
          height={height}
        />
      )}
      
      {/* Chart content (success with data or refreshing) */}
      {(loadingState.status === 'success' || loadingState.status === 'refreshing') &&
        !isEmpty && (
          <div className={styles.chartContainer}>
            {children}
          </div>
        )}
    </>
  );
  
  return (
    <>
      <div
        ref={containerRef}
        className={`${styles.wrapper} ${className || ''}`}
        data-testid="chart-wrapper"
        role="region"
        aria-label={`Chart: ${title}`}
        aria-busy={loadingState.status === 'loading' || loadingState.status === 'refreshing'}
      >
        {/* Screen reader announcements */}
        <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {loadingState.status === 'loading' && `Loading ${title} chart data`}
          {loadingState.status === 'refreshing' && `Refreshing ${title} chart data`}
          {loadingState.status === 'success' && !isEmpty && `${title} chart loaded successfully`}
          {loadingState.status === 'error' && `Error loading ${title} chart`}
          {isEmpty && `No data available for ${title} chart`}
        </div>
        
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title} id={`chart-title-${title.replace(/\s+/g, '-').toLowerCase()}`}>
            {title}
          </h2>
          <div className={styles.headerActions}>
            {actions}
            {renderControls()}
            {enableExport && onExport && (
              <ExportMenu
                onExport={handleExport}
                isExporting={isExporting}
                disabled={loadingState.status === 'loading' || isEmpty}
              />
            )}
          </div>
        </div>
        
        {/* Content area */}
        <div className={styles.content}>
          {renderContent()}
        </div>
      </div>
      
      {/* Fullscreen view */}
      {enableFullscreen && (
        <FullscreenView
          isActive={isFullscreen}
          onExit={exitFullscreen}
          title={title}
        >
          {renderContent()}
        </FullscreenView>
      )}
      
      {/* Mini-player view */}
      {enableMiniPlayer && (
        <MiniPlayer
          isActive={isMiniPlayer}
          onClose={exitMiniPlayer}
          title={title}
        >
          {renderContent()}
        </MiniPlayer>
      )}
    </>
  );
}
