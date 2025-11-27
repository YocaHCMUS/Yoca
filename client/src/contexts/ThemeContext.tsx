/**
 * Theme Context Provider
 * Manages global theme state (light/dark mode)
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

/**
 * Available theme modes
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Theme context type
 */
interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

/**
 * Local storage key for theme preference
 */
const THEME_STORAGE_KEY = 'yoca_theme_preference';

/**
 * Theme context
 */
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Props for ThemeProvider component
 */
interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Get initial theme from localStorage or system preference
 */
const getInitialTheme = (): ThemeMode => {
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  // Check system preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
};

/**
 * Theme Provider Component
 * Wraps the application to provide theme state and methods
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  /**
   * Persist theme to localStorage when it changes
   */
  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

/**
 * Hook to use theme context
 * @returns Theme context
 * @throws Error if used outside ThemeProvider
 */
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
