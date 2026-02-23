/**
 * FullscreenView Component
 *
 * Provides fullscreen viewing mode for charts with native API support and modal fallback.
 *
 * Features:
 * - Native Fullscreen API with modal fallback
 * - ESC key handler for exit
 * - Focus trap for keyboard navigation
 * - Dark overlay for enhanced visibility
 * - Loading state during fullscreen transition
 *
 * @module components/charts/shared/FullscreenView
 */

import { Theme } from "@carbon/react";
import React, { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useUserTheme } from "../../../contexts/ThemeContext";
import styles from "./FullscreenView.module.scss";

export interface FullscreenViewProps {
  /** Whether fullscreen mode is active */
  isActive: boolean;

  /** Callback when fullscreen is exited */
  onExit: () => void;

  /** Content to display in fullscreen */
  children: React.ReactNode;

  /** Chart title for accessibility */
  title?: string;
}

/**
 * FullscreenView Component
 *
 * Displays chart content in fullscreen mode with keyboard navigation support.
 * Uses native Fullscreen API when available, falls back to modal overlay.
 */
export const FullscreenView: React.FC<FullscreenViewProps> = ({
  isActive,
  onExit,
  children,
  title = "Chart",
}) => {
  const { t } = useTranslation();
  const { theme } = useUserTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  /**
   * Handle ESC key press to exit fullscreen
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onExit();
      }
    },
    [onExit],
  );

  /**
   * Handle fullscreen change events
   */
  const handleFullscreenChange = useCallback(() => {
    if (!document.fullscreenElement) {
      onExit();
    }
  }, [onExit]);

  /**
   * Request native fullscreen mode
   */
  const requestFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (containerRef.current.requestFullscreen) {
        await containerRef.current.requestFullscreen();
      }
    } catch (error) {
      console.warn(
        "Fullscreen API not supported, using modal fallback:",
        error,
      );
    }
  }, []);

  /**
   * Exit native fullscreen mode
   */
  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.warn("Error exiting fullscreen:", error);
    }
  }, []);

  /**
   * Setup focus trap for keyboard navigation
   */
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // Store previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the container
    containerRef.current.focus();

    // Setup focus trap
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    };

    containerRef.current.addEventListener("keydown", handleTabKey);

    return () => {
      containerRef.current?.removeEventListener("keydown", handleTabKey);

      // Restore focus to previous element
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isActive]);

  /**
   * Setup fullscreen API and keyboard handlers
   */
  useEffect(() => {
    if (!isActive) return;

    // Try to use native fullscreen API
    requestFullscreen();

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      exitFullscreen();
    };
  }, [
    isActive,
    handleKeyDown,
    handleFullscreenChange,
    requestFullscreen,
    exitFullscreen,
  ]);

  if (!isActive) {
    return null;
  }

  return createPortal(
    <Theme theme={theme === "dark" ? "g100" : "white"}>
      <div
        ref={containerRef}
        className={styles.fullscreenView}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} - ${t("charts.fullscreenView")}`}
        tabIndex={-1}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button
            className={styles.exitButton}
            onClick={onExit}
            aria-label={t("charts.exitFullscreen")}
            title={t("charts.exitFullscreenEsc")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>{children}</div>
      </div>
    </Theme>,
    document.body,
  );
};

export default FullscreenView;
