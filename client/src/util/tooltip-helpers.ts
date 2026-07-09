/**
 * Tooltip Formatting Utilities
 * 
 * Provides consistent tooltip formatting across all chart components.
 * 
 * @module tooltip-helpers
 */

/**
 * Tooltip row options
 */
export interface TooltipRowOptions {
  /** Color indicator for the row */
  color?: string;
  /** Whether to show the color circle indicator */
  showIndicator?: boolean;
  /** Custom color for the label */
  labelColor?: string;
  /** Custom color for the value */
  valueColor?: string;
  /** Additional inline styles */
  style?: string;
}

/**
 * Create a tooltip header with consistent styling
 * 
 * @param title - Header text
 * @param style - Additional inline styles
 * @returns HTML string for tooltip header
 * 
 * @example
 * ```ts
 * createTooltipHeader('Oct 10, 2025')
 * // Returns: <div style="font-weight: 600; margin-bottom: 8px;">Oct 10, 2025</div>
 * ```
 */
export function createTooltipHeader(title: string, style?: string): string {
  const baseStyle = 'font-weight: 600; margin-bottom: 8px;';
  const combinedStyle = style ? `${baseStyle} ${style}` : baseStyle;
  return `<div style="${combinedStyle}">${title}</div>`;
}

/**
 * Create a colored circle indicator
 * 
 * @param color - Circle background color
 * @returns HTML string for circle indicator
 */
export function createSeriesIndicator(color: string): string {
  return `<span style="display:inline-block;margin-right:5px;border-radius:50%;width:10px;height:10px;background-color:${color};"></span>`;
}

/**
 * Create a tooltip row with label and value in flexbox layout
 * 
 * @param label - Row label text (can include HTML)
 * @param value - Row value text (wrapped in <strong> tag)
 * @param options - Additional styling options
 * @returns HTML string for tooltip row
 * 
 * @example
 * ```ts
 * createTooltipRow('Balance', '$1,234.56')
 * // Returns: <div style="margin-top: 4px; width: 100%; display:flex; justify-content: space-between; gap: 8px">...</div>
 * 
 * createTooltipRow('SOL', '$120', { color: '#F2994A', showIndicator: true })
 * // Returns: <div>...<circle indicator>SOL: ...<strong>$120</strong>...</div>
 * ```
 */
export function createTooltipRow(
  label: string,
  value: string,
  options: TooltipRowOptions = {}
): string {
  const {
    color,
    showIndicator = false,
    labelColor,
    valueColor,
    style = '',
  } = options;

  const baseStyle = 'margin-top: 4px; width: 100%; display:flex; justify-content: space-between; gap: 8px';
  const combinedStyle = style ? `${baseStyle}; ${style}` : baseStyle;

  const indicator = showIndicator && color ? createSeriesIndicator(color) : '';
  const labelStyle = labelColor ? ` style="color: ${labelColor}"` : '';
  const valueStyle = valueColor ? ` style="color: ${valueColor}"` : '';

  return `
    <div style="${combinedStyle}">
      <span${labelStyle}>
        ${indicator}${label}${showIndicator ? ':' : ''}
      </span>
      <strong${valueStyle}>${value}</strong>
    </div>
  `;
}

/**
 * Format parameters for axis-based tooltips (multiple series)
 * 
 * @param params - ECharts tooltip params array
 * @param headerFormatter - Function to format the tooltip header (receives first param)
 * @param valueFormatter - Function to format each series value (receives param, index)
 * @returns HTML string for complete tooltip
 * 
 * @example
 * ```ts
 * formatAxisTooltip(
 *   params,
 *   (p) => formatTimestampWithTimezone(p.value[0], timezone, 'PPpp'),
 *   (p) => formatCurrency(p.value[1])
 * )
 * ```
 */
export function formatAxisTooltip(
  params: unknown,
  headerFormatter: (param: { value: number[]; seriesName?: string; color?: string }) => string,
  valueFormatter: (param: { value: number[]; seriesName?: string; color?: string }, index: number) => string,
  options: { showSeriesIndicator?: boolean } = {}
): string {
  if (!Array.isArray(params) || params.length === 0) return '';

  const { showSeriesIndicator = true } = options;
  const tooltipParams = params as { value: number[]; seriesName?: string; color?: string }[];

  let tooltipContent = createTooltipHeader(headerFormatter(tooltipParams[0]));

  tooltipParams.forEach((param, index) => {
    const value = valueFormatter(param, index);
    tooltipContent += createTooltipRow(
      param.seriesName ?? "",
      value,
      {
        color: param.color,
        showIndicator: showSeriesIndicator,
      }
    );
  });

  return tooltipContent;
}

/**
 * Format parameters for item-based tooltips (single item, multiple rows)
 * 
 * @param headerTitle - Tooltip header text
 * @param rows - Array of row configurations
 * @returns HTML string for complete tooltip
 * 
 * @example
 * ```ts
 * formatItemTooltip('Wallet ABC...XYZ', [
 *   { label: 'Rank', value: '#1' },
 *   { label: 'Total Volume', value: '$150,000' },
 *   { label: 'Deposits', value: '$100,000', labelColor: '#52c41a' },
 * ])
 * ```
 */
export function formatItemTooltip(
  headerTitle: string,
  rows: Array<{ label: string; value: string } & TooltipRowOptions>
): string {
  let tooltipContent = createTooltipHeader(headerTitle);

  rows.forEach((row) => {
    const { label, value, ...options } = row;
    tooltipContent += createTooltipRow(label, value, options);
  });

  return tooltipContent;
}

/**
 * Format date header for time-based tooltips
 * 
 * @param timestamp - Unix timestamp or Date object
 * @param formatter - Date formatting function
 * @returns Formatted date string
 * 
 * @example
 * ```ts
 * formatDateHeader(1234567890, (ts) => formatTimestampWithTimezone(ts, 'UTC', 'PPpp'))
 * ```
 */
export function formatDateHeader(
  timestamp: number | Date,
  formatter: (ts: number) => string
): string {
  const ts = timestamp instanceof Date ? timestamp.getTime() : timestamp;
  return formatter(ts);
}
