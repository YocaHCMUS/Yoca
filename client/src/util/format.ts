export function formatNumber(num: number): string {
  if (num === 0) return "0";

  if (Math.abs(num) < 1) {
    // Show up to 8 decimal places but trim trailing zeros
    return parseFloat(num.toFixed(8)).toString();
  }

  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function chunkArray<T>(data: T[], size: number): T[][] {
  if (data.length === 0) {
    return [];
  }

  const normalizedSize = Math.floor(size);
  if (!Number.isFinite(normalizedSize) || normalizedSize <= 0) {
    return [data.slice()];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < data.length; index += normalizedSize) {
    chunks.push(data.slice(index, index + normalizedSize));
  }

  return chunks;
}

export function formatAddress(address: string): string {
  if (!address || address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

export function formatChangePercent(value: number | null | undefined): string {
  if (value == null) return "\u2013";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatTimestamp(time: string | null | undefined | Date): string {
  if (!time) return "\u2013";
  
  const date = new Date(time);
  
  // Check for invalid date (e.g., from null/undefined)
  if (isNaN(date.getTime())) return "\u2013";
  
  const now = new Date();
  const diffSeconds = (now.getTime() - date.getTime()) / 1000;

  // Only show "just now" for timestamps that are truly near the present.
  if (Math.abs(diffSeconds) < 5) {
    return "just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export const DEX_LABELS: Record<string, string> = {
  raydium: "Raydium",
  raydium_clmm: "Raydium CLMM",
  raydium_cpmm: "Raydium CPMM",
  orca: "Orca",
  orca_whirlpools: "Orca Whirlpools",
  meteora: "Meteora",
  meteora_dlmm: "Meteora DLMM",
  lifinity_v2: "Lifinity V2",
  pancakeswap_v3: "Pancakeswap V3",
};

export function dexLabel(dexId: string | null | undefined): string {
  if (!dexId) return "\u2013";
  return (
    DEX_LABELS[dexId] ??
    dexId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatPriceString(priceValue: string | number | undefined): string {
  if (priceValue == null) return "\u2013";
  const num =
    typeof priceValue === "number"
      ? priceValue
      : parseFloat(priceValue.replace(/[^\d.-]/g, ""));
  if (isNaN(num)) return priceValue.toString();
  if (num < 0.0001) return `$${num.toExponential(4)}`;
  if (num < 0.01) return `$${num.toFixed(6)}`;
  if (num < 1) return `$${num.toFixed(4)}`;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPct(value: number | undefined): { text: string; positive: boolean | null } {
  if (value === undefined) return { text: "\u2013", positive: null };
  const positive = value >= 0;
  return { text: `${positive ? "\u25b2" : "\u25bc"} ${Math.abs(value).toFixed(1)}%`, positive };
}

/**
 * Format a numeric USD price with smart decimal precision.
 * - null/undefined/NaN → "—"
 * - < 0.0001 → exponential notation  e.g. $1.23e-5
 * - < 1      → 5 decimal places      e.g. $0.01234
 * - >= 1     → 2 decimal places      e.g. $1,234.56
 */
export function formatPrice(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return "—";
  if (v < 0.0001) return `$${v.toExponential(3)}`;
  if (v < 1) return `$${v.toFixed(5)}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a percentage change value with sign, returning both
 * the display text and a `positive` flag for conditional styling.
 * - null/undefined/NaN → { text: "—", positive: null }
 */
export function formatChange(v: number | null | undefined): { text: string; positive: boolean | null } {
  if (v == null || isNaN(v)) return { text: "—", positive: null };
  const positive = v >= 0;
  return { text: `${positive ? "+" : ""}${v.toFixed(2)}%`, positive };
}
