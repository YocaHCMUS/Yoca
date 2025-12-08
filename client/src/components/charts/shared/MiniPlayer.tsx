/**
 * MiniPlayer Component
 * 
 * Provides a draggable and resizable mini-player mode for charts.
 * 
 * Features:
 * - Drag and resize with react-rnd
 * - ESC key to close
 * - Minimize/maximize controls
 * - Persistent position and size
 * - Z-index management for multiple mini-players
 * 
 * @module components/charts/shared/MiniPlayer
 */

import React, { useCallback, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { createPortal } from 'react-dom';
import { Theme } from '@carbon/react';
import { useTheme } from '../../../contexts/ThemeContext';
import styles from './MiniPlayer.module.scss';

export interface MiniPlayerProps {
  /** Whether mini-player mode is active */
  isActive: boolean;
  
  /** Callback when mini-player is closed */
  onClose: () => void;
  
  /** Content to display in mini-player */
  children: React.ReactNode;
  
  /** Chart title */
  title?: string;
  
  /** Initial position (default: bottom-right) */
  defaultPosition?: { x: number; y: number };
  
  /** Initial size (default: 400x300) */
  defaultSize?: { width: number; height: number };
}

/**
 * MiniPlayer Component
 * 
 * Displays chart content in a draggable, resizable mini-player window.
 */
export const MiniPlayer: React.FC<MiniPlayerProps> = ({
  isActive,
  onClose,
  children,
  title = 'Chart',
  defaultPosition,
  defaultSize = { width: 400, height: 300 },
}) => {
  const { theme } = useTheme();
  const [isMinimized, setIsMinimized] = useState(false);
  const [size, setSize] = useState(defaultSize);
  const previousSizeRef = useRef(defaultSize);
  
  // Calculate position relative to current scroll position
  const getInitialPosition = useCallback(() => {
    if (defaultPosition) return defaultPosition;
    
    // Get current scroll position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    
    // Calculate position in document coordinates (viewport position + scroll)
    return {
      x: scrollX + window.innerWidth - 420,
      y: scrollY + window.innerHeight - 320
    };
  }, [defaultPosition]);
  
  const [position, setPosition] = useState(getInitialPosition);
  
  // Update position when activated to account for current scroll position
  React.useEffect(() => {
    if (isActive) {
      setPosition(getInitialPosition());
    }
  }, [isActive, getInitialPosition]);
  
  /**
   * Handle ESC key press to close mini-player
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose]);
  
  /**
   * Toggle minimize/maximize state
   */
  const toggleMinimize = useCallback(() => {
    if (isMinimized) {
      // Restore previous size
      setSize(previousSizeRef.current);
    } else {
      // Store current size before minimizing
      previousSizeRef.current = size;
      setSize({ width: size.width, height: 48 }); // Minimize to header only
    }
    setIsMinimized(!isMinimized);
  }, [isMinimized, size]);
  
  /**
   * Handle drag stop to save position
   */
  const handleDragStop = useCallback((_e: any, data: { x: number; y: number }) => {
    setPosition({ x: data.x, y: data.y });
  }, []);
  
  /**
   * Handle resize stop to save size
   */
  const handleResizeStop = useCallback(
    (_e: any, _direction: any, ref: HTMLElement, _delta: any, position: { x: number; y: number }) => {
      setSize({
        width: ref.offsetWidth,
        height: ref.offsetHeight,
      });
      setPosition(position);
    },
    []
  );
  
  if (!isActive) {
    return null;
  }
  
  return createPortal(
    <Rnd
      position={{
        x: position.x,
        y: position.y,
      }}
      size={{
        width: size.width,
        height: size.height,
      }}
      minWidth={320}
      minHeight={isMinimized ? 48 : 240}
      maxWidth={window.innerWidth * 0.9}
      maxHeight={window.innerHeight * 0.9}
      bounds="parent"
      dragHandleClassName={styles.header}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      enableResizing={!isMinimized}
      style={{
        zIndex: 999,
      }}
      className={styles.miniPlayer}
    >
      <Theme theme={theme === 'dark' ? 'g100' : 'white'}>
        <div
          className={styles.container}
          onKeyDown={handleKeyDown}
          role="dialog"
          aria-modal="false"
          aria-label={`${title} - Mini Player`}
          tabIndex={-1}
        >
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <div className={styles.dragHandle} aria-label="Drag to move">
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <circle cx="4" cy="4" r="1.5" />
                <circle cx="4" cy="8" r="1.5" />
                <circle cx="4" cy="12" r="1.5" />
                <circle cx="8" cy="4" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="8" cy="12" r="1.5" />
              </svg>
            </div>
            <h3 className={styles.title}>{title}</h3>
          </div>
          
          <div className={styles.headerRight}>
            <button
              className={styles.minimizeButton}
              onClick={toggleMinimize}
              aria-label={isMinimized ? 'Maximize' : 'Minimize'}
              title={isMinimized ? 'Maximize' : 'Minimize'}
            >
              {isMinimized ? (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="4 9 8 5 12 9" />
                </svg>
              ) : (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="2" y1="8" x2="14" y2="8" />
                </svg>
              )}
            </button>
            
            <button
              className={styles.closeButton}
              onClick={onClose}
              aria-label="Close mini-player"
              title="Close mini-player (ESC)"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="4" x2="4" y2="12" />
                <line x1="4" y1="4" x2="12" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className={styles.content}>
            {children}
          </div>
        )}
        </div>
      </Theme>
    </Rnd>,
    document.body
  );
};

export default MiniPlayer;
