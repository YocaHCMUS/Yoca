import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

const nullDisplay = "-";
type NumberLike = number | string | null;
type NullableDayJsConfig = dayjs.ConfigType | null;

type Notation = "standard" | "compact";
type Style = "decimal" | "currency" | "percent" | "unit";

/**
 * Determines the number of decimal places to display for a numeric value.
 * The rule is based on the fractional part of the absolute value:
 *   - frac in [0.01, 1)      -> 4 decimals  e.g. $1.246678 -> $1.2467
 *   - frac in [0.0001, 0.01) -> 6 decimals  e.g. $81.00147367 -> $81.001474
 *   - frac < 0.0001           -> 8 decimals
 */
function resolveDecimals(value: number): number {
  const frac = Math.abs(value) % 1;
  if (frac >= 0.01) return 4;
  if (frac >= 0.0001) return 6;
  return 8;
}

export function defineNumberFormat(
  langCode: string,
  styleFormatMap: Record<Style, Intl.NumberFormatOptions>,
  getExchangeRate?: () => number,
) {
  const formatterMap = new Map<string, Intl.NumberFormat>();

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

    let key = `${effectiveStyle}|${notation}`;
    let extraOptions: Intl.NumberFormatOptions = {};
    if (effectiveStyle == "currency" || effectiveStyle == "decimal") {
      const decimals = resolveDecimals(exchangedValue);
      key = `${key}|${decimals}`;
      extraOptions = { maximumFractionDigits: decimals };
    }

    if (!formatterMap.has(key)) {
      const numFmt = new Intl.NumberFormat(langCode, {
        ...styleFormatMap[effectiveStyle],
        ...extraOptions,
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
    const abs = Math.abs(v);
    const opts = { maximumFractionDigits: 2 };
    if (langCode.startsWith("vi")) {
      const sym = "đồng";
      if (abs >= 1e12)
        return `${(v / 1e12).toLocaleString(langCode, opts)} nghìn tỷ ${sym}`;
      if (abs >= 1e9)
        return `${(v / 1e9).toLocaleString(langCode, opts)} tỷ ${sym}`;
      if (abs >= 1e6)
        return `${(v / 1e6).toLocaleString(langCode, opts)} triệu ${sym}`;
      if (abs >= 1e3)
        return `${(v / 1e3).toLocaleString(langCode, opts)} nghìn ${sym}`;
      return `${v.toLocaleString(langCode, { maximumFractionDigits: 0 })} ${sym}`;
    }
    if (abs > 0 && abs < 1)
      return createNotation("standard").currency(numValue);
    return createNotation("compact").currency(numValue);
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
  function toLocal(value: dayjs.ConfigType) {
    return dayjs.utc(value).local().locale(langCode);
  }

  return {
    date: (value: NullableDayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.datePattern) : nullDisplay,
    time: (value: NullableDayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.timePattern) : nullDisplay,
    datetime: (value: NullableDayJsConfig) =>
      value ? toLocal(value).format(fmtInfo.dateTimePattern) : nullDisplay,
    utc: (value: NullableDayJsConfig) =>
      value
        ? dayjs.utc(value).locale(langCode).format(fmtInfo.utcDateTimePattern)
        : nullDisplay,
    iso: (value: NullableDayJsConfig) =>
      value ? dayjs.utc(value).toISOString() : nullDisplay,
    relative: (value: NullableDayJsConfig) =>
      value ? toLocal(value).fromNow() : nullDisplay,
    fromUnixSeconds: (seconds: number | null) =>
      seconds
        ? toLocal(dayjs.unix(seconds)).format(fmtInfo.dateTimePattern)
        : nullDisplay,
    fromUnixMilliseconds: (ms: number | null) =>
      ms ? toLocal(dayjs(ms)).format(fmtInfo.dateTimePattern) : nullDisplay,
  };
}
