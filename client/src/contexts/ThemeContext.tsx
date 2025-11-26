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
  setTheme: (theme: ThemeMode) => void;
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
  defaultTheme?: ThemeMode;
}

/**
 * Get initial theme from localStorage or system preference
 */
const getInitialTheme = (defaultTheme?: ThemeMode): ThemeMode => {
  // Check localStorage first
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  // Use provided default theme
  if (defaultTheme) {
    return defaultTheme;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  // Default to light theme
  return 'light';
};

/**
 * Apply theme to document
 */
const applyTheme = (theme: ThemeMode): void => {
  const root = document.documentElement;
  const body = document.body;

  if (theme === 'dark') {
    root.classList.add('dark');
    body.classList.add('dark');
    root.setAttribute('data-carbon-theme', 'g100'); // Carbon dark theme
    root.setAttribute('data-theme', 'dark'); // Custom theme variables
  } else {
    root.classList.remove('dark');
    body.classList.remove('dark');
    root.setAttribute('data-carbon-theme', 'white'); // Carbon light theme
    root.setAttribute('data-theme', 'light'); // Custom theme variables
  }
};

/**
 * Theme Provider Component
 * Wraps the application to provide theme state and methods
 */
export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, defaultTheme }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => getInitialTheme(defaultTheme));

  /**
   * Apply theme on mount and when theme changes
   */
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  /**
   * Listen for system theme changes
   */
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't manually set a preference
      const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (!storedTheme) {
        setThemeState(e.matches ? 'dark' : 'light');
      }
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Legacy browsers
    else if (mediaQuery.addListener) {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  /**
   * Toggle between light and dark themes
   */
  const toggleTheme = useCallback(() => {
    setThemeState((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  /**
   * Set theme to a specific value
   */
  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
  }, []);

  const contextValue: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
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

/**
 * Hook to get current theme only
 * Useful when you only need to read the theme without calling methods
 */
export const useThemeMode = (): ThemeMode => {
  const { theme } = useTheme();
  return theme;
};
