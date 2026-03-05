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
      let numFmt = new Intl.NumberFormat(langCode, {
        ...styleFormatMap[effectiveStyle],
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

  return {
    ...createNotation("standard"),
    compact: createNotation("compact"),
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
