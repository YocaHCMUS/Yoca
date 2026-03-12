import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

const nullDisplay = "-";
type NullableNumber = number | null;
type NullableDayJsConfig = dayjs.ConfigType | null;

type Notation = "standard" | "compact";
type Style = "decimal" | "currency" | "percent" | "unit";

export function defineNumberFormat(
  langCode: string,
  styleFormatMap: Record<Style, Intl.NumberFormatOptions>,
  getExchangeRate?: () => number,
) {
  const formatterMap = new Map<string, Intl.NumberFormat>();

  function format(
    value: NullableNumber,
    abs: boolean,
    style: Style,
    notation: Notation,
    unit?: string,
  ) {
    // Token symbols (SOL, BONK, etc.) are NOT valid Intl.NumberFormat units.
    // Always use "decimal" formatting and append the symbol as a text suffix.
    const effectiveStyle = style === "unit" ? "decimal" : style;
    const key = `${effectiveStyle}|${notation}`;

    if (!formatterMap.has(key)) {
      const styleOpts = { ...styleFormatMap[effectiveStyle] };
      if (notation === "compact") {
        styleOpts.minimumFractionDigits = 0;
        styleOpts.maximumFractionDigits = 2;
      }
      let numFmt = new Intl.NumberFormat(langCode, {
        ...styleOpts,
        notation,
        style: effectiveStyle,
      });
      formatterMap.set(key, numFmt);
    }

    if (!value) return nullDisplay;

    const exchangedValue =
      style == "currency" && getExchangeRate
        ? value * getExchangeRate()
        : style == "percent"
          ? value / 100.0
          : value;

    const formatted = formatterMap
      .get(key)!
      .format(abs ? Math.abs(exchangedValue) : exchangedValue);

    // Append unit suffix for "unit" style
    if (style === "unit" && unit) {
      return `${formatted} ${unit}`;
    }

    return formatted;
  }

  function createNotation(notation: Notation) {
    return {
      decimal: (value: NullableNumber, abs: boolean = false) =>
        format(value, abs, "decimal", notation),
      currency: (value: NullableNumber, abs: boolean = false) =>
        format(value, abs, "currency", notation),
      percent: (value: NullableNumber, abs: boolean = false) =>
        format(value, abs, "percent", notation),
      unit: (value: NullableNumber, unit: string, abs: boolean = false) =>
        format(value, abs, "unit", notation, unit),
    };
  }

  // Compact currency with readable full words (avoids Intl abbreviations like N/T/NT/Tr)
  function readableCompactCurrency(value: NullableNumber): string {
    if (!value) return nullDisplay;
    const v = getExchangeRate ? value * getExchangeRate() : value;
    const abs = Math.abs(v);
    const opts = { maximumFractionDigits: 2 };
    if (langCode.startsWith("vi")) {
      const sym = "đồng";
      if (abs >= 1e12) return `${(v / 1e12).toLocaleString(langCode, opts)} nghìn tỷ ${sym}`;
      if (abs >= 1e9)  return `${(v / 1e9).toLocaleString(langCode, opts)} tỷ ${sym}`;
      if (abs >= 1e6)  return `${(v / 1e6).toLocaleString(langCode, opts)} triệu ${sym}`;
      if (abs >= 1e3)  return `${(v / 1e3).toLocaleString(langCode, opts)} nghìn ${sym}`;
      return `${v.toLocaleString(langCode, { maximumFractionDigits: 0 })} ${sym}`;
    }
    // For non-vi locales: use standard notation for small values (< 1) to avoid rounding to $0
    const absVal = Math.abs(value);
    if (absVal > 0 && absVal < 1) return createNotation("standard").currency(value);
    return createNotation("compact").currency(value);
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
    fromUnixSeconds: (seconds: NullableNumber) =>
      seconds
        ? toLocal(dayjs.unix(seconds)).format(fmtInfo.dateTimePattern)
        : nullDisplay,
    fromUnixMilliseconds: (ms: NullableNumber) =>
      ms ? toLocal(dayjs(ms)).format(fmtInfo.dateTimePattern) : nullDisplay,
  };
}
