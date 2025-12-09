/**
 * eCharts Setup with Tree-Shaking
 * 
 * This module configures Apache eCharts with selective imports to minimize bundle size.
 * Only the required chart types and components are imported.
 * 
 * Bundle Impact: ~105KB gzipped (with all required components)
 * 
 * @module echarts-setup
 */

import * as echarts from 'echarts/core';

// Import chart types
import {
  LineChart,
  BarChart,
  PieChart,
  type LineSeriesOption,
  type BarSeriesOption,
  type PieSeriesOption,
} from 'echarts/charts';

// Import components
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,
  type TitleComponentOption,
  type TooltipComponentOption,
  type GridComponentOption,
  type LegendComponentOption,
  type DataZoomComponentOption,
  type ToolboxComponentOption,
  type MarkLineComponentOption,
  type MarkPointComponentOption,
} from 'echarts/components';

// Import renderers
import { CanvasRenderer } from 'echarts/renderers';

// Import transformers for data sampling
import { LabelLayout, UniversalTransition } from 'echarts/features';

// Combine chart option types
export type ECOption = echarts.ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | PieSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | GridComponentOption
  | LegendComponentOption
  | DataZoomComponentOption
  | ToolboxComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
>;

// Register components with eCharts
echarts.use([
  // Chart types
  LineChart,
  BarChart,
  PieChart,

  // Components
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  ToolboxComponent,
  MarkLineComponent,
  MarkPointComponent,

  // Features
  LabelLayout,
  UniversalTransition,

  // Renderer
  CanvasRenderer,
]);

/**
 * Default color palette for charts
 * Uses colors compatible with Carbon Design System
 */
export const DEFAULT_COLORS = [
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
];

/**
 * Default theme configuration
 */
export const DEFAULT_THEME = {
  color: DEFAULT_COLORS,
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 12,
    color: '#161616',
  },
  title: {
    textStyle: {
      fontSize: 14,
      fontWeight: 600,
      color: '#161616',
    },
  },
  tooltip: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderColor: '#e0e0e0',
    borderWidth: 1,
    textStyle: {
      color: '#161616',
    },
  },
  legend: {
    textStyle: {
      color: '#525252',
    },
  },
  grid: {
    containLabel: true,
    left: '3%',
    right: '4%',
    bottom: '3%',
    top: '10%',
  },
};

/**
 * Export the configured eCharts instance
 */
export { echarts };

/**
 * Type-safe eCharts instance type
 */
export type EChartsInstance = ReturnType<typeof echarts.init>;
