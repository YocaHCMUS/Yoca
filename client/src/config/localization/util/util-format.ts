import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import type { NumberFormattingStrategy } from "./formatter-strategy";

const nullDisplay = "-";
type NumberLike = number | string | null;
type DayJsConfig = dayjs.ConfigType;

type Notation = "standard" | "compact";
type Style = "decimal" | "currency" | "percent" | "unit";

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

    if (typeof value !== "number" && typeof value !== "string")
      return nullDisplay;
    const numValue = typeof value == "string" ? Number(value) : value;
    if (!Number.isFinite(numValue)) return nullDisplay;

    const exchangedValue =
      style == "currency" && getExchangeRate
        ? numValue * getExchangeRate()
        : numValue;

    let decimals = 2;
    if (effectiveStyle == "currency") {
      decimals = strategy.decimalResolution.resolveCurrency(exchangedValue);
    } else if (effectiveStyle == "decimal") {
      decimals = strategy.decimalResolution.resolveDecimal(exchangedValue);
    } else if (effectiveStyle == "percent") {
      decimals = strategy.decimalResolution.resolvePercent(exchangedValue);
    }

    if (notation === "compact" && Math.abs(exchangedValue) >= 1000) {
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

  return {
    ...createNotation("standard"),
    compact: createNotation("compact"),
    readableCompact: {
      currency: readableCompactCurrency,
    },
  };
}

dayjs.extend(utc);
dayjs.extend(relativeTime);

export function defineDateTimeFormat(
  langCode: string,
  fmtInfo: {
    datePattern: string;
    timePattern: string;
    dateTimePattern: string;
    utcDateTimePattern: string;
  },
) {
  function toLocal(value: DayJsConfig) {
    return dayjs.utc(value).local().locale(langCode);
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
    relative: (value: DayJsConfig) =>
      value ? toLocal(value).fromNow() : nullDisplay,
    fromUnixSeconds: (seconds: number | null) =>
      seconds
        ? toLocal(dayjs.unix(seconds)).format(fmtInfo.dateTimePattern)
        : nullDisplay,
    fromUnixMilliseconds: (ms: number | null) =>
      ms ? toLocal(dayjs(ms)).format(fmtInfo.dateTimePattern) : nullDisplay,
  };
}
