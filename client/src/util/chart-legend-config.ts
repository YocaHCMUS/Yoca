/**
 * Chart Legend Configuration Utility
 * 
 * Provides unified legend styling configurations for all chart components
 * to ensure consistent appearance and behavior across the application.
 * 
 * @module util/chart-legend-config
 */

import type { ChartThemeConfig } from '@/hooks/useChartTheme';

/**
 * Legend position options
 */
export type LegendPosition = 'top' | 'bottom' | 'left' | 'right';

/**
 * Legend orientation options
 */
export type LegendOrientation = 'horizontal' | 'vertical';

/**
 * Legend configuration options
 */
export interface LegendConfigOptions {
  /** Show/hide legend */
  show?: boolean;

  /** Legend position */
  position?: LegendPosition;

  /** Legend orientation */
  orientation?: LegendOrientation;

  /** Distance from the position edge (percentage or pixels) */
  offset?: string | number;

  /** Legend data array */
  data?: string[];

  /** Custom icon type */
  icon?: 'circle' | 'rect' | 'roundRect' | 'triangle' | 'diamond' | 'pin' | 'arrow' | 'none';

  /** Icon width */
  itemWidth?: number;

  /** Icon height */
  itemHeight?: number;

  /** Gap between legend items */
  itemGap?: number;

  /** Custom text style overrides */
  textStyle?: {
    fontSize?: number;
    fontWeight?: string | number;
  };

  /** Whether to account for a chart title above */
  hasTitle?: boolean;
}

/**
 * Default legend configuration values
 */
const DEFAULTS = {
  itemWidth: 14,
  itemHeight: 14,
  itemGap: 16,
  fontSize: 12,
  offsetTop: '5%',
  offsetBottom: '5%',
  offsetLeft: '3%',
  offsetRight: '3%',
  offsetWithTitle: '12%',
};

/**
 * Get unified legend configuration based on options
 * 
 * @param theme - Chart theme configuration
 * @param options - Legend configuration options
 * @returns ECharts legend configuration object
 * 
 * @example
 * ```typescript
 * // Simple multi-series legend at top
 * const legend = getLegendConfig(chartTheme, {
 *   show: true,
 *   data: ['Series 1', 'Series 2'],
 * });
 * 
 * // Vertical legend for pie chart
 * const legend = getLegendConfig(chartTheme, {
 *   show: true,
 *   orientation: 'vertical',
 *   position: 'right',
 *   data: ['Category A', 'Category B'],
 * });
 * 
 * // Legend with custom icon
 * const legend = getLegendConfig(chartTheme, {
 *   show: true,
 *   icon: 'roundRect',
 *   itemWidth: 20,
 *   itemHeight: 12,
 * });
 * ```
 */
export function getLegendConfig(
  theme: ChartThemeConfig,
  options: LegendConfigOptions = {}
): any {
  const {
    show = true,
    position = 'top',
    orientation = 'horizontal',
    offset,
    data,
    icon = 'circle',
    itemWidth = DEFAULTS.itemWidth,
    itemHeight = DEFAULTS.itemHeight,
    itemGap = DEFAULTS.itemGap,
    textStyle,
    hasTitle = false,
  } = options;

  // Calculate position offset
  const getPositionOffset = () => {
    if (offset !== undefined) return offset;

    if (position === 'top') {
      return hasTitle ? DEFAULTS.offsetWithTitle : DEFAULTS.offsetTop;
    }
    if (position === 'bottom') return DEFAULTS.offsetBottom;
    if (position === 'left') return DEFAULTS.offsetLeft;
    if (position === 'right') return DEFAULTS.offsetRight;

    return DEFAULTS.offsetTop;
  };

  // Build legend alignment based on position
  const getAlignment = () => {
    if (orientation === 'vertical') {
      if (position === 'left') return { left: getPositionOffset(), top: 'center' };
      if (position === 'right') return { right: getPositionOffset(), top: 'center' };
      return { left: 'center', top: getPositionOffset() };
    }

    // Horizontal orientation
    if (position === 'top') return { top: getPositionOffset(), left: 'center' };
    if (position === 'bottom') return { bottom: getPositionOffset(), left: 'center' };
    if (position === 'left') return { left: getPositionOffset(), top: 'center' };
    if (position === 'right') return { right: getPositionOffset(), top: 'center' };

    return { top: getPositionOffset(), left: 'center' };
  };

  return {
    show,
    orient: orientation,
    ...getAlignment(),
    data,
    icon,
    itemWidth,
    itemHeight,
    itemGap,
    textStyle: {
      color: theme.textColorSecondary,
      fontSize: textStyle?.fontSize ?? DEFAULTS.fontSize,
      fontWeight: textStyle?.fontWeight ?? 'normal',
    },
  };
}

/**
 * Preset configurations for common legend use cases
 */

/**
 * Get legend config for single-series charts (usually hidden)
 */
export function getSingleSeriesLegend(theme: ChartThemeConfig): any {
  return getLegendConfig(theme, { show: false });
}

/**
 * Get legend config for multi-series line/bar charts
 */
export function getMultiSeriesLegend(
  theme: ChartThemeConfig,
  data: string[],
  hasTitle = false
): any {
  return getLegendConfig(theme, {
    show: true,
    position: 'top',
    orientation: 'horizontal',
    data,
    icon: 'circle',
    hasTitle,
  });
}

/**
 * Get legend config for pie/donut charts (vertical, right-aligned)
 */
export function getPieLegend(
  theme: ChartThemeConfig,
  data: string[],
  show = true
): any {
  return getLegendConfig(theme, {
    show,
    position: 'bottom',
    orientation: 'horizontal',
    data,
    icon: 'circle',
  });
}

/**
 * Get legend config for dual-axis charts
 */
export function getDualAxisLegend(
  theme: ChartThemeConfig,
  data: string[],
  hasTitle = false
): any {
  return getLegendConfig(theme, {
    show: true,
    position: 'top',
    orientation: 'horizontal',
    data,
    icon: 'roundRect',
    itemWidth: 20,
    itemHeight: 12,
    hasTitle,
  });
}

/**
 * Get legend config for stacked charts
 */
export function getStackedChartLegend(
  theme: ChartThemeConfig,
  data: string[],
  hasTitle = false
): any {
  return getLegendConfig(theme, {
    show: true,
    position: 'top',
    orientation: 'horizontal',
    data,
    icon: 'rect',
    itemWidth: 16,
    itemHeight: 14,
    hasTitle,
  });
}

/**
 * Get legend config for bottom-positioned legends
 */
export function getBottomLegend(
  theme: ChartThemeConfig,
  data: string[],
  icon: 'circle' | 'rect' | 'roundRect' = 'circle'
): any {
  return getLegendConfig(theme, {
    show: true,
    position: 'bottom',
    orientation: 'horizontal',
    data,
    icon,
    offset: 10,
  });
}

/**
 * Helper to conditionally show/hide legend based on data series count
 */
export function getConditionalLegend(
  theme: ChartThemeConfig,
  data: string[],
  minSeriesCount = 2,
  hasTitle = false
): any {
  const shouldShow = data.length >= minSeriesCount;

  return getLegendConfig(theme, {
    show: shouldShow,
    position: 'top',
    orientation: 'horizontal',
    data,
    icon: 'circle',
    hasTitle,
  });
}
