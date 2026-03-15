export interface DecimalResolutionStrategy {
  resolveCurrency(value: number): number;
  resolveDecimal(value: number): number;
  resolvePercent(value: number): number;
}

export interface CurrencyConfigStrategy {
  currencyCode(): string;
  currencyDisplay(): "symbol" | "narrowSymbol" | "code" | "name";
}

export interface ReadableCompactCurrencyStrategy {
  format(value: number, opts: Intl.NumberFormatOptions): string;
}

export interface NumberFormattingStrategy {
  decimalResolution: DecimalResolutionStrategy;
  currencyConfig: CurrencyConfigStrategy;
  readableCompactCurrency: ReadableCompactCurrencyStrategy;
}
