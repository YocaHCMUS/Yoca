/**
 * useChartTheme Hook
 * 
 * Provides theme-aware color schemes and configurations for ECharts.
 * 
 * @module useChartTheme
 */

import { useMemo } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import type { ThemeMode } from '../contexts/ThemeContext';

/**
 * Chart theme configuration
 */
export interface ChartThemeConfig {
  /** Background color for the chart */
  backgroundColor: string;
  
  /** Text color for labels and legends */
  textColor: string;
  
  /** Secondary text color */
  textColorSecondary: string;
  
  /** Border and grid line color */
  borderColor: string;
  
  /** Tooltip background color */
  tooltipBgColor: string;
  
  /** Tooltip border color */
  tooltipBorderColor: string;
  
  /** Axis line color */
  axisLineColor: string;
  
  /** Split line color for grids */
  splitLineColor: string;
  
  /** Color palette for series */
  colorPalette: string[];
}

/**
 * Light theme configuration
 */
const LIGHT_THEME: ChartThemeConfig = {
  backgroundColor: '#ffffff',
  textColor: '#161616',
  textColorSecondary: '#525252',
  borderColor: '#e0e0e0',
  tooltipBgColor: 'rgba(255, 255, 255, 0.95)',
  tooltipBorderColor: '#e0e0e0',
  axisLineColor: '#e0e0e0',
  splitLineColor: '#f4f4f4',
  colorPalette: [
    '#0f62fe', // Blue
    '#24a148', // Green
    '#da1e28', // Red
    '#8a3ffc', // Purple
    '#ff832b', // Orange
    '#f1c21b', // Yellow
    '#08bdba', // Teal
    '#d12771', // Magenta
    '#491d8b', // Dark Purple
    '#002d9c', // Dark Blue
  ],
};

/**
 * Dark theme configuration
 */
const DARK_THEME: ChartThemeConfig = {
  backgroundColor: '#161616',
  textColor: '#f4f4f4',
  textColorSecondary: '#c6c6c6',
  borderColor: '#393939',
  tooltipBgColor: 'rgba(38, 38, 38, 0.95)',
  tooltipBorderColor: '#525252',
  axisLineColor: '#393939',
  splitLineColor: '#262626',
  colorPalette: [
    '#4589ff', // Lighter Blue
    '#42be65', // Lighter Green
    '#ff8389', // Lighter Red
    '#be95ff', // Lighter Purple
    '#ff9d57', // Lighter Orange
    '#f1c21b', // Yellow
    '#3ddbd9', // Lighter Teal
    '#ee5396', // Lighter Magenta
    '#a56eff', // Lighter Dark Purple
    '#408bfc', // Lighter Dark Blue
  ],
};

/**
 * Get theme configuration based on theme mode
 */
function getThemeConfig(theme: ThemeMode): ChartThemeConfig {
  return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
}

/**
 * Custom hook for chart theming
 * 
 * Provides theme-aware color schemes and configurations for charts.
 * Automatically updates when the global theme changes.
 * 
 * @returns Chart theme configuration
 * 
 * @example
 * ```tsx
 * const { backgroundColor, textColor, colorPalette } = useChartTheme();
 * 
 * const chartOption = {
 *   backgroundColor,
 *   color: colorPalette,
 *   textStyle: {
 *     color: textColor,
 *   },
 *   // ... rest of chart config
 * };
 * ```
 */
export function useChartTheme(): ChartThemeConfig {
  const { theme } = useTheme();
  
  return useMemo(() => getThemeConfig(theme), [theme]);
}

/**
 * Generate ECharts base option with theme support
 * 
 * @param themeConfig - Chart theme configuration
 * @returns Base ECharts option with theme applied
 */
export function getThemedChartBaseOption(themeConfig: ChartThemeConfig) {
  return {
    backgroundColor: themeConfig.backgroundColor,
    color: themeConfig.colorPalette,
    textStyle: {
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 12,
      color: themeConfig.textColor,
    },
    title: {
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: themeConfig.textColor,
      },
    },
    tooltip: {
      backgroundColor: themeConfig.tooltipBgColor,
      borderColor: themeConfig.tooltipBorderColor,
      borderWidth: 1,
      textStyle: {
        color: themeConfig.textColor,
      },
    },
    legend: {
      textStyle: {
        color: themeConfig.textColorSecondary,
      },
    },
    xAxis: {
      axisLine: {
        lineStyle: {
          color: themeConfig.axisLineColor,
        },
      },
      axisLabel: {
        color: themeConfig.textColorSecondary,
      },
      splitLine: {
        lineStyle: {
          color: themeConfig.splitLineColor,
        },
      },
    },
    yAxis: {
      axisLine: {
        lineStyle: {
          color: themeConfig.axisLineColor,
        },
      },
      axisLabel: {
        color: themeConfig.textColorSecondary,
      },
      splitLine: {
        lineStyle: {
          color: themeConfig.splitLineColor,
        },
      },
    },
  };
}
