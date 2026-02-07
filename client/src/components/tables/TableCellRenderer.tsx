
import { CheckmarkFilled, CloseFilled } from '@carbon/icons-react';

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
export const renderDateTime = (value: string, options?: Intl.DateTimeFormatOptions) => {
  const date = new Date(value);
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options
  };
  
  return <span>{date.toLocaleString(undefined, defaultOptions)}</span>;
};