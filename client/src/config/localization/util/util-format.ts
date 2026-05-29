import { ELLIPSIS } from "@/config/constants";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import type { NumberFormattingStrategy } from "./formatter-strategy";

const nullDisplay = "-";
type NumberLike = number | string | null;
type DayJsConfig = dayjs.ConfigType;

type Notation = "standard" | "compact";
type Style = "decimal" | "currency" | "percent" | "unit";

export type AddressTruncationPosition = "start" | "middle" | "end";

export interface AddressFormattingOptions {
  maxLength?: number;
  position?: AddressTruncationPosition;
}

export function defineTextFormat() {
  return {
    address(
      address: string | null | undefined,
      opts: AddressFormattingOptions = {},
    ): string {
      if (!address) return nullDisplay;

      const maxLength = opts.maxLength ?? 8;
      const position = opts.position ?? "middle";

      if (address.length <= maxLength) {
        return address;
      }

      const ellipsis = ELLIPSIS;

      switch (position) {
        case "start": {
          return `${ellipsis}${address.slice(-maxLength)}`;
        }
        case "end": {
          return `${address.slice(0, maxLength)}${ellipsis}`;
        }
        case "middle":
        default: {
          const sideLength = Math.floor(maxLength / 2);
          return `${address.slice(0, sideLength)}${ellipsis}${address.slice(-sideLength)}`;
        }
      }
    },
    txHash(
      hash: string | null | undefined,
      opts: AddressFormattingOptions = {},
    ): string {
      if (!hash) return nullDisplay;

      const maxLength = opts.maxLength ?? 16;
      const position = opts.position ?? "middle";

      if (hash.length <= maxLength) {
        return hash;
      }

      const ellipsis = ELLIPSIS;

      switch (position) {
        case "start": {
          return `${ellipsis}${hash.slice(-maxLength)}`;
        }
        case "end": {
          return `${hash.slice(0, maxLength)}${ellipsis}`;
        }
        case "middle":
        default: {
          const sideLength = Math.floor(maxLength / 2);
          return `${hash.slice(0, sideLength)}${ellipsis}${hash.slice(-sideLength)}`;
        }
      }
    },
  };
}

// Look kinda cheap heh?
// 1e-12 would be written like this: 0.0₁₂1
function toSubscript(num: number): string {
  const map = "₀₁₂₃₄₅₆₇₈₉";
  return String(num)
    .split("")
    .map((d) => map[Number(d)] ?? d)
    .join("");
}

function formatSmallCompact(value: number): string {
  if (value == 0){
    return "0";
  }
  
  if (value < 1e-16){
    return "> 0.0₁₆1";
  }

  const str = value.toPrecision(16);

  const match = str.match(/^0\.0+/);
  if (!match) return value.toString();

  const zeroCount = match[0].length - 2;

  const remaining = str.slice(match[0].length);
  const significant = remaining.replace(/0+$/, "").slice(0, 4);

  return `0.0${toSubscript(zeroCount)}${significant}`;
}

function replaceNumbers(formatted: string, replacement: string): string {
  const numberPattern = /-?(?:\d+(?:\.\d+)?|\.\d+)/;
  return formatted.replace(numberPattern, replacement);
}

export function defineNumberFormat(
  langCode: string,
  strategy: NumberFormattingStrategy,
  getExchangeRate?: () => number,
) {
  const formatterMap = new Map<string, Intl.NumberFormat>();

  function buildIntlOptions(
    style: Style,
    decimals: number,
  ): Intl.NumberFormatOptions {
    const opts: Intl.NumberFormatOptions = {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals,
    };

    if (style == "currency") {
      return {
        ...opts,
        style: "currency",
        currency: strategy.currencyConfig.currencyCode(),
        currencyDisplay: strategy.currencyConfig.currencyDisplay(),
      };
    }

    return opts;
  }

  function format(
    value: NumberLike,
    abs: boolean,
    style: Style,
    notation: Notation,
    unit?: string | null,
  ) {
    const effectiveStyle = style == "unit" ? "decimal" : style;

    if (typeof value != "number" && typeof value != "string")
      return nullDisplay;
    const numValue = typeof value == "string" ? Number(value) : value;
    if (!Number.isFinite(numValue)) return nullDisplay;

    const exchangedValue =
      style == "currency" && getExchangeRate
        ? numValue * getExchangeRate()
        : style == "percent"
          ? numValue / 100
          : numValue;

    const absValue = Math.abs(exchangedValue);

    let decimals = 2;
    if (effectiveStyle == "currency") {
      decimals = strategy.decimalResolution.resolveCurrency(exchangedValue);
    } else if (effectiveStyle == "decimal") {
      decimals = strategy.decimalResolution.resolveDecimal(exchangedValue);
    } else if (effectiveStyle == "percent") {
      decimals = strategy.decimalResolution.resolvePercent(exchangedValue);
    }

    if (notation == "compact" && Math.abs(exchangedValue) >= 1000) {
      decimals = Math.min(decimals, 2);
    }

    const key = `${effectiveStyle}|${notation}|${decimals}`;
    const styleOptions = buildIntlOptions(effectiveStyle, decimals);

    if (!formatterMap.has(key)) {
      const numFmt = new Intl.NumberFormat(langCode, {
        ...styleOptions,
        notation,
        style: effectiveStyle,
      });
      formatterMap.set(key, numFmt);
    }

    const formatted = formatterMap
      .get(key)!
      .format(abs ? Math.abs(exchangedValue) : exchangedValue);

    if (style == "unit" && unit) {
      return `${formatted} ${unit}`;
    }

    // small number override for compact
    if (notation == "compact" && absValue < strategy.smallCompactThreshold) {
      return replaceNumbers(
        formatted,
        formatSmallCompact(abs ? absValue : exchangedValue),
      );
    }

    return formatted;
  }

  function createNotation(notation: Notation) {
    return {
      decimal: (value: NumberLike, abs: boolean = false) =>
        format(value, abs, "decimal", notation),
      currency: (value: NumberLike, abs: boolean = false) =>
        format(value, abs, "currency", notation),
      percent: (value: NumberLike, abs: boolean = false) =>
        format(value, abs, "percent", notation),
      unit: (value: NumberLike, unit: string | null, abs: boolean = false) =>
        format(value, abs, "unit", notation, unit),
    };
  }

  function readableCompactCurrency(value: NumberLike): string {
    if (value == null || value == undefined || value == "") return nullDisplay;
    const numValue = typeof value == "string" ? Number(value) : value;
    if (!Number.isFinite(numValue)) return nullDisplay;
    const v = getExchangeRate ? numValue * getExchangeRate() : numValue;
    const opts = { maximumFractionDigits: 2 };

    return strategy.readableCompactCurrency.format(v, opts);
  }

  function percentagePoint(value: NumberLike, abs: boolean = false): string {
    if (value == null || value == undefined || value == "") return nullDisplay;
    const numValue = typeof value == "string" ? Number(value) : value;
    if (!Number.isFinite(numValue)) return nullDisplay;
    const v = abs ? Math.abs(numValue) : numValue;
    const sign = v >= 0 ? "+" : "";
    const decimals = strategy.decimalResolution.resolvePercent(v / 100);
    return `${sign}${v.toFixed(decimals)}%`;
  }

  return {
    ...createNotation("standard"),
    compact: createNotation("compact"),
    readableCompact: {
      currency: readableCompactCurrency,
    },
    percentagePoint,
  };
}

dayjs.extend(utc);
dayjs.extend(relativeTime);

export type DateTimeFormattingInfo = {
  datePattern: string;
  timePattern: string;
  dateTimePattern: string;
  utcDateTimePattern: string;
  relativeShortTimeConfig?: {
    future: string;
    past: string;
    s: string;
    m: string;
    mm: string;
    h: string;
    hh: string;
    d: string;
    dd: string;
    M: string;
    MM: string;
    y: string;
    yy: string;
  };
};

export function defineDateTimeFormat(
  langCode: string,
  fmtInfo: DateTimeFormattingInfo,
) {
  // Register short relative time locale if provided
  if (fmtInfo.relativeShortTimeConfig) {
    const shortLocaleCode = `${langCode}-short`;
    dayjs.locale(shortLocaleCode, {
      relativeTime: fmtInfo.relativeShortTimeConfig,
    });
  }

  function toLocal(value: DayJsConfig) {
    return dayjs.utc(value).local().locale(langCode);
  }

  function toLocalShort(value: DayJsConfig) {
    const shortLocaleCode = `${langCode}-short`;
    return dayjs.utc(value).local().locale(shortLocaleCode);
  }

  function duration(ms: number | null): string {
    if (ms == null) return nullDisplay;
    const seconds = Math.floor(ms / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  return {
    date: (value: DayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.datePattern) : nullDisplay,
    time: (value: DayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.timePattern) : nullDisplay,
    datetime: (value: DayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.dateTimePattern) : nullDisplay,
    utc: (value: DayJsConfig) =>
      value
        ? dayjs.utc(value).locale(langCode).format(fmtInfo.utcDateTimePattern)
        : nullDisplay,
    iso: (value: DayJsConfig) =>
      value ? dayjs.utc(value).toISOString() : nullDisplay,
    relative: (value: DayJsConfig, noSuffix: boolean = false) =>
      value ? toLocal(value).fromNow(noSuffix) : nullDisplay,
    relativeShort: (value: DayJsConfig, noSuffix: boolean = false) =>
      fmtInfo.relativeShortTimeConfig && value
        ? toLocalShort(value).fromNow(noSuffix)
        : value
          ? toLocal(value).fromNow()
          : nullDisplay,
    fromUnixSeconds: (seconds: number | null) =>
      seconds
        ? toLocal(dayjs.unix(seconds)).format(fmtInfo.dateTimePattern)
        : nullDisplay,
    fromUnixMilliseconds: (ms: number | null) =>
      ms ? toLocal(dayjs(ms)).format(fmtInfo.dateTimePattern) : nullDisplay,
    duration,
  };
}
