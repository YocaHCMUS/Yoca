import React from 'react';
import { CheckmarkFilled, CloseFilled, CaretUp, CaretDown, Subtract } from '@carbon/icons-react';

/**
 * Renders a value as monospace code with secondary color
 * Useful for displaying signatures, hashes, or technical identifiers
 */
export const renderCode = (value: string) => (
  <code style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }} title={value}>
    {value}
  </code>
);

/**
 * Higher-order function that wraps any renderer with truncation and tooltip functionality
 * @param value - The original full value
 * @param renderFn - The render function to apply to the truncated value
 * @param limit - Maximum characters to show before truncation (default: 6)
 * 
 * @example
 * renderLong(longAddress, renderCode, 8)
 * renderLong(longText, renderBold, 10)
 * renderLong(longHash, (val) => renderCurrency(val, '$'), 6)
 */
export const renderLong = (
  value: string, 
  renderFn: (value: string) => React.ReactNode, 
  limit: number = 6
) => {
  const truncatedValue = value.length > limit ? value.slice(0, limit) + '...' : value;
  
  return (
    <span
      style={{ 
        cursor: 'help',
        padding: '2px 4px',
        borderRadius: '2px',
        transition: 'background-color 0.2s ease',
        display: 'inline-block',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--cds-layer-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title={value}
    >
      {renderFn(truncatedValue)}
    </span>
  );
};

/**
 * Renders a shortened version of a long string value with full text in tooltip
 * Shows approximately first 6 characters with ellipsis
 * Convenience function that wraps renderCode with renderLong
 */
export const renderLongCode = (value: string, limit: number = 6) => {
  return renderLong(value, renderCode, limit);
};

/**
 * Renders a binary value with conditional coloring
 * @param colorMap - Map of value to color variable name (e.g., {'Buy': 'var(--cds-support-success)'})
 */
export const renderBinaryValue = (
  value: string,
  colorMap: Record<string, string>
) => (
  <span style={{ 
    color: colorMap[value] || 'inherit',
    fontWeight: 600 
  }}>
    {value}
  </span>
);

/**
 * Renders text in bold weight
 */
export const renderBold = (value: string) => (
  <span style={{ fontWeight: 600 }}>{value}</span>
);

/**
 * Renders a numeric value with currency symbol
 */
export const renderCurrency = (value: string, symbol: string = '$', isInFront: boolean = true) => (
    isInFront? <span>{symbol}{value}</span> : <span>{value}{symbol}</span>
);

/**
 * Renders a status with icon and conditional coloring
 * @param successValues - Array of values considered as success (default: ['Success'])
 * @param successIcon - Icon component to show for success
 * @param errorIcon - Icon component to show for error
 */
export const renderStatus = (
  value: string,
  successValues: string[] = ['Success'],
  successIcon = CheckmarkFilled,
  errorIcon = CloseFilled
) => {
  const isSuccess = successValues.includes(value);
  const Icon = isSuccess ? successIcon : errorIcon;
  
  return (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      color: isSuccess ? 'var(--cds-support-success)' : 'var(--cds-support-error)',
      fontWeight: 600
    }}>
      <Icon size={16} />
      {value}
    </span>
  );
};

/**
 * Renders a relative time string from ISO datetime
 */
export const renderRelativeTime = (value: string) => {
  const now = Date.now();
  const timestamp = new Date(value).getTime();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return <span>{days}d ago</span>;
  if (hours > 0) return <span>{hours}h ago</span>;
  if (minutes > 0) return <span>{minutes}m ago</span>;
  return <span>{seconds}s ago</span>;
};

/**
 * Renders an absolute datetime in readable format
 */
export const renderDateTime = (
  value: string,
  optionsOrFormatter?: Intl.DateTimeFormatOptions | ((value: string | null) => string),
  formatter?: (value: string | null) => string,
) => {
  const localizationFormatter =
    typeof optionsOrFormatter === 'function' ? optionsOrFormatter : formatter;

  if (localizationFormatter) {
    return <span>{localizationFormatter(value)}</span>;
  }

  const options = typeof optionsOrFormatter === 'function' ? undefined : optionsOrFormatter;
  const date = new Date(value);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  };

  return <span>{date.toLocaleString(undefined, defaultOptions)}</span>;
};

enum ValueState {
  Positive,
  Neutral,
  Negative
}

/**
 * Renders a positive/negative value with conditional coloring and optional icons
 * @param value - The numeric value as string
 * @param haveIcon - Whether to show up/down/neutral icons
 * @param percentage - Whether to format as percentage
 */
export const renderPositiveNegative = (value: string, haveIcon: boolean = true, percentage: boolean = false) => {
  const numValue = parseFloat(value);
  const state = numValue > 0 ? ValueState.Positive : numValue < 0 ? ValueState.Negative : ValueState.Neutral;
  
  const getColor = () => {
    switch (state) {
      case ValueState.Positive:
        return 'var(--cds-support-success)';
      case ValueState.Negative:
        return 'var(--cds-support-error)';
      default:
        return 'var(--cds-text-secondary)';
    }
  };
  
  const getIcon = () => {
    if (!haveIcon) return null;
    
    switch (state) {
      case ValueState.Positive:
        return <CaretUp size={16} />;
      case ValueState.Negative:
        return <CaretDown size={16} />;
      default:
        return <Subtract size={16} />;
    }
  };
  
  const formattedValue = percentage ? `${numValue.toFixed(2)}%` : numValue.toFixed(2);
  
  return (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      color: getColor(),
      fontWeight: 600
    }}>
      {state === ValueState.Positive && !percentage && '+'}
      {formattedValue}
      {getIcon()}
    </span>
  );
}