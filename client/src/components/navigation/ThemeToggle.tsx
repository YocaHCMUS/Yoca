/**
 * ThemeToggle Component
 * Button to toggle between light and dark themes
 */

import React from 'react';
import { HeaderGlobalAction } from '@carbon/react';
import { Asleep, Light } from '@carbon/icons-react';
import { useTheme } from '../../contexts/ThemeContext';
import styles from './ThemeToggle.module.scss';

/**
 * ThemeToggle Component
 * Displays sun/moon icon and toggles theme on click
 */
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  /**
   * Handle theme toggle
   */
  const handleToggle = () => {
    toggleTheme();
  };

  const isDark = theme === 'dark';

  return (
    <div className={styles.themeToggleWrapper}>
      <HeaderGlobalAction
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        tooltipAlignment="end"
        onClick={handleToggle}
        className={styles.themeToggle}
      >
        {isDark ? <Light size={20} /> : <Asleep size={20} />}
      </HeaderGlobalAction>
    </div>
  );
};

export default ThemeToggle;
