import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";

type Notation = "standard" | "compact";
type Style = "decimal" | "currency" | "percent" | "unit";

export function defineNumberFormat(
  langCode: string,
  styleFormatMap: Record<Style, Intl.NumberFormatOptions>,
) {
  const formatterMap = new Map<string, Intl.NumberFormat>();

  function getFormatter(style: Style, notation: Notation, unit?: string) {
    const key = `${style}|${notation}|${unit ?? ""}`;
    if (!formatterMap.has(key)) {
      formatterMap.set(
        key,
        new Intl.NumberFormat(langCode, styleFormatMap[style]),
      );
    }

    return formatterMap.get(key)!;
  }

  function createNotation(notation: Notation) {
    return {
      decimal: (value: number) =>
        getFormatter("decimal", notation).format(value),

      currency: (value: number) =>
        getFormatter("currency", notation).format(value),

      percent: (value: number) =>
        getFormatter("percent", notation).format(value),

      unit: (value: number, unit: string) =>
        getFormatter("unit", notation, unit).format(value),
    };
  }

  return {
    ...createNotation("standard"),
    compact: createNotation("compact"),
  };
}

dayjs.extend(utc);
dayjs.extend(relativeTime);

type DateTimeFormat = {
  date: (value: dayjs.ConfigType) => string;
  time: (value: dayjs.ConfigType) => string;
  datetime: (value: dayjs.ConfigType) => string;
  utc: (value: dayjs.ConfigType) => string;
  iso: (value: dayjs.ConfigType) => string;
  relative: (value: dayjs.ConfigType) => string;
  fromUnixSeconds: (seconds: number) => string;
  fromUnixMilliseconds: (ms: number) => string;
};

export function defineDateTimeFormat(
  langCode: string,
  fmtInfo: {
    datePattern: string;
    timePattern: string;
    dateTimePattern: string;
    utcDateTimePattern: string;
  },
): DateTimeFormat {
  function toLocal(value: dayjs.ConfigType) {
    return dayjs.utc(value).local().locale(langCode);
  }

  return {
    date: (value) => toLocal(value).format(fmtInfo.datePattern),
    time: (value) => toLocal(value).format(fmtInfo.timePattern),
    datetime: (value) => toLocal(value).format(fmtInfo.dateTimePattern),
    utc: (value) =>
      dayjs.utc(value).locale(langCode).format(fmtInfo.utcDateTimePattern),
    iso: (value) => dayjs.utc(value).toISOString(),
    relative: (value) => toLocal(value).fromNow(),
    fromUnixSeconds: (seconds) =>
      toLocal(dayjs.unix(seconds)).format(fmtInfo.dateTimePattern),
    fromUnixMilliseconds: (ms) => toLocal(ms).format(fmtInfo.dateTimePattern),
  };
}
