import React, { useState } from 'react';
import { Button, Checkbox } from '@carbon/react';
import { CheckmarkFilled, CloseFilled, CaretUp, CaretDown, Subtract, Copy, Checkmark } from '@carbon/icons-react';
import SparklineChart from '@/components/charts/SparklineChart';
import { TokenIdentityCell } from '../token/TokenIdentityCell.tsx';
import type { TranslateFunction } from '@/contexts/LocalizationContext.tsx';
import type { WalletSwapTokenInfo } from '@/services/wallet/walletApi.ts';
export interface SparklineCellValue {
  data: number[];
  positive?: boolean;
  width?: string | number;
  height?: number;
  paddingLeft?: number;
}

/**
 * Renders a value as monospace code with secondary color
 * Useful for displaying signatures, hashes, or technical identifiers
 */
export const renderCode = (value: unknown) => {
  let normalized = '';

  if (typeof value === 'string') {
    normalized = value;
  } else if (value == null) {
    normalized = '';
  } else {
    try {
      normalized = JSON.stringify(value);
    } catch {
      normalized = String(value);
    }
  }

  return (
    <code style={{ color: 'var(--cds-text-secondary)', fontSize: '0.75rem' }} title={normalized}>
      {normalized}
    </code>
  );
};

function toDisplayText(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value == null) {
    return '';
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export const renderBase = (value: unknown, formatter?: (value: string) => React.ReactNode) => {
  const displayText = toDisplayText(value);
  return (
    <span>{formatter ? formatter(displayText) : displayText}</span>
  );
};

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

export const renderReducedNumber = (
  value: string,
  renderFn: (value: string) => React.ReactNode,
  bcp47Locale: string = 'en-US',
) => {
  // if value is in (0, 0.0001) => render as "< 0.0001"
  // if > 1000 => render as xK, the same is true for M, B,...
  const numValue = Number(value);

  if (Number.isNaN(numValue)) {
    return renderFn(value);
  }

  if (numValue > 0 && numValue < 0.0001) {
    return renderFn('< 0.0001');
  }

  if (Math.abs(numValue) > 1000) {
    // Use the caller-supplied BCP-47 locale so compact suffixes (K/M/B) match
    // the app's selected language while still avoiding OS-locale surprises.
    const compact = new Intl.NumberFormat(bcp47Locale, {
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(numValue);

    return renderFn(compact);
  }

  return renderFn(Number.parseFloat(value).toFixed(4));
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
 * Renders a hash/signature in truncated form (first N + last N chars) with a copy button.
 * Full value is shown in a tooltip on hover.
 */
export const renderHash = (value: string, prefixLen: number = 6, suffixLen: number = 4) => {
  const truncated =
    value.length > prefixLen + suffixLen + 3
      ? `${value.slice(0, prefixLen)}...${value.slice(-suffixLen)}`
      : value;

  const CopyButton = () => {
    const [copied, setCopied] = useState(false);
    const handleCopy = (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(value).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    };
    return (
      <button
        onClick={handleCopy}
        title={copied ? 'Copied!' : 'Copy'}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 2px',
          color: copied ? 'var(--cds-support-success)' : 'var(--cds-text-secondary)',
          display: 'inline-flex',
          alignItems: 'center',
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      >
        {copied ? <Checkmark size={12} /> : <Copy size={12} />}
      </button>
    );
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', maxWidth: '100%' }}>
      <code
        title={value}
        style={{
          color: 'var(--cds-text-secondary)',
          fontSize: '0.75rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {truncated}
      </code>
      <CopyButton />
    </span>
  );
};

export const renderTokenCell = (
  token: WalletSwapTokenInfo,
  classNames?: {
    container?: string;
    amount?: string;
  },
  imageSize?: number,
) => {
  return (value: string, row?: unknown[] | null) => {
    if (!Array.isArray(row)) {
      return renderCode(value);
    }

    return (
      <span className={classNames?.container}>
        <span className={classNames?.amount}>{Math.abs(token.amount).toFixed(4)}</span>
        <TokenIdentityCell
          symbol={token.symbol || "Unknown"}
          fullName={token.name ?? undefined}
          imageUrl={token.logoUri ?? undefined}
          imageSize={imageSize}
          showInitialsFallback
          tooltipAlign="right"
        />
      </span>
    );
  };
};

export interface ProfilePortfolioCellRendererOptions {
  selectedComparisonWalletAddresses: string[];
  onComparisonToggle: (walletAddress: string, checked: boolean) => void;
  onUnlinkWallet: (walletAddress: string) => void | Promise<void>;
  formatAddress: (address: string) => string;
  formatCurrency: (value: number) => string;
  t: TranslateFunction;
}

export const createProfilePortfolioCellRenderers = ({
  selectedComparisonWalletAddresses,
  onComparisonToggle,
  onUnlinkWallet,
  formatAddress,
  formatCurrency,
  t,
}: ProfilePortfolioCellRendererOptions) => [
    (_value: unknown, row: unknown[]) => {
      const walletAddress = String(row[0] ?? '');

      return (
        <div onClick={(event) => event.stopPropagation()}>
          <Checkbox
            id={`wallet-compare-${walletAddress}`}
            labelText=""
            hideLabel
            checked={selectedComparisonWalletAddresses.includes(walletAddress)}
            onChange={(_, state) => onComparisonToggle(walletAddress, state.checked)}
          />
        </div>
      );
    },
    null,
    (_value: unknown, row: unknown[]) => {
      const walletAddress = String(row[2] ?? '');

      return <span title={walletAddress}>{formatAddress(walletAddress)}</span>;
    },
    (value: unknown) => formatCurrency(Number(value)),
    (value: unknown) => String(value),
    (isAuthWallet: unknown, row: unknown[]) => {
      if (typeof isAuthWallet !== 'boolean') {
        return null;
      }

      const walletAddress = String(row[0] ?? '');

      return (
        <div onClick={(event) => event.stopPropagation()}>
          <Button
            size="sm"
            kind="ghost"
            disabled={isAuthWallet}
            title={isAuthWallet ? t('profileTabs.portfolio.authWalletCannotBeUnlinked') : t('profileTabs.portfolio.unlinkWallet')}
            onClick={() => onUnlinkWallet(walletAddress)}
          >
            {t('profileTabs.portfolio.unlinkWallet')}
          </Button>
        </div>
      );
    },
  ];

export const renderSparkline = (value: unknown) => {
  if (!value || typeof value !== 'object') {
    return '-';
  }

  const sparkline = value as SparklineCellValue;
  const points = Array.isArray(sparkline.data) ? sparkline.data : [];

  if (points.length === 0) {
    return '-';
  }

  return (
    <div
      style={{
        width: sparkline.width ?? '100%',
        height: sparkline.height ?? 40,
        paddingLeft: sparkline.paddingLeft ?? 24,
      }}
    >
      <SparklineChart
        data={points}
        positive={sparkline.positive ?? true}
      />
    </div>
  );
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
export const renderCurrency = (value: unknown, symbol: string = '$', isInFront: boolean = true) => {
  const normalized = toDisplayText(value);
  return (
    isInFront ? <span>{symbol}{normalized}</span> : <span>{normalized}{symbol}</span>
  );
};

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