import {
  locale,
  type BaseTranslation,
  type FmtStrParams,
  type NumberFormatInfo,
  type PathValue,
  type TranslationKeyPath,
  type TranslationSchema,
  type WithBase,
} from "@/config/localization";
import type { DatetimeFormatInfo } from "@/config/localization/util/util-format";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import relativeTime from "dayjs/plugin/relativeTime";
import utc from "dayjs/plugin/utc";
import React, { useState } from "react";

dayjs.extend(utc);
dayjs.extend(relativeTime);

type LangCode = keyof typeof locale;

// This helps the error when you mistype the key (eg. tr("non_existent_key")) will be at the key name itself.
// Though if you continue to type in the second argument, it'd both show the error at the wrong key
// and hint the type of second argument as all the format variables of the translation
type TranslateFunction = {
  <K extends TranslationKeyPath>(
    key: K,
  ): FmtStrParams<PathValue<BaseTranslation, K>> extends undefined
    ? WithBase<PathValue<BaseTranslation, K>>
    : never;

  <K extends TranslationKeyPath>(
    key: K,
    params: FmtStrParams<PathValue<BaseTranslation, K>>,
  ): WithBase<PathValue<BaseTranslation, K>>;
};

type Formatter = {
  num: NumberFormatter;
  datetime: DatetimeFormatter;
};

type NumberFormatter = {
  num: (value: number, decimalMin?: number, decimalMax?: number) => string;
  percent: (
    percentage: number,
    decimalMin?: number,
    decimalMax?: number,
  ) => string;
  currency: (value: number, decimalMin?: number, decimalMax?: number) => string;
};

type DatetimeFormatter = {
  date: (value: string | number | Date) => string;
  time: (value: string | number | Date) => string;
  datetime: (value: string | number | Date) => string;
  utc: (value: string | number | Date) => string;
  iso: (value: string | number | Date) => string;
  relative: (value: string | number | Date) => string;

  fromUnixSeconds: (seconds: number) => string;
  fromUnixMilliseconds: (ms: number) => string;
};

type LocalizationContextType = {
  lang: LangCode;
  setLang: React.Dispatch<React.SetStateAction<LangCode>>;
  tr: TranslateFunction;
  fmt: Formatter;
};

type PluralSelection =
  | { ok: false }
  | { ok: true; selection: { singular: string; plural: string } };

function tryGetPluralSelection(key: string): PluralSelection {
  const parts = key.split("|");
  if (parts.length != 2 || parts[0].length <= 0 || parts[1].length <= 0) {
    return { ok: false };
  } else {
    return {
      ok: true,
      selection: { singular: parts[0], plural: parts[1] },
    };
  }
}

const LocalizationContext = React.createContext<
  LocalizationContextType | undefined
>(undefined);

// Safe any because TranslationKeyPath guarantees the leaf exists
function getTranslationValue(
  translation: TranslationSchema,
  path: TranslationKeyPath,
): string {
  return path
    .split(".")
    .reduce((acc, part) => (acc as any)[part], translation as any) as string;
}

function interpolate(
  template: string,
  params: Record<string, string | number>,
) {
  const count = Number(params.count);

  return template.replace(/{{(.*?)}}/g, (_, key) => {
    const hasCount = Number.isNaN(count);

    const res = tryGetPluralSelection(key);
    if (res.ok && !hasCount) {
      return count != 1 ? res.selection.plural : res.selection.singular;
    }

    return String(params[key.trim()]) ?? "";
  });
}

export function LocalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLang] = useState<LangCode>("en");

  function tr<K extends TranslationKeyPath>(
    key: K,
  ): FmtStrParams<PathValue<BaseTranslation, K>> extends undefined
    ? string
    : never;

  function tr<K extends TranslationKeyPath>(
    key: K,
    params: FmtStrParams<PathValue<BaseTranslation, K>>,
  ): string;

  function tr(key: TranslationKeyPath, params?: any): string {
    const template = getTranslationValue(locale[lang].translation, key);
    if (params) {
      return interpolate(template, params);
    }
    return template;
  }

  const fmt: Formatter = {
    num: {
      num: (value, decimalMin = 2, decimalMax = 4) =>
        formatNumber(value, decimalMin, decimalMax, locale[lang].format.num),

      percent: (percentage, decimalMin = 2, decimalMax = 4) =>
        formatPercent(
          percentage,
          decimalMin,
          decimalMax,
          locale[lang].format.num,
        ),

      currency: (value, decimalMin = 2, decimalMax = 4) =>
        formatCurrency(value, decimalMin, decimalMax, locale[lang].format.num),
    },

    datetime: {
      date: (value) => formatDate(value, lang, locale[lang].format.datetime),

      time: (value) => formatTime(value, lang, locale[lang].format.datetime),

      datetime: (value) =>
        formatDateTime(value, lang, locale[lang].format.datetime),

      utc: (value) =>
        formatUtcDateTime(value, lang, locale[lang].format.datetime),

      iso: (value) => formatIsoDateTime(value),

      relative: (value) => formatRelativeTime(value, lang),

      fromUnixSeconds: (seconds) =>
        formatUnixSeconds(seconds, lang, locale[lang].format.datetime),

      fromUnixMilliseconds: (ms) =>
        formatUnixMilliseconds(ms, lang, locale[lang].format.datetime),
    },
  };

  return (
    <LocalizationContext.Provider value={{ lang, setLang, tr, fmt }}>
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const ctx = React.useContext(LocalizationContext);

  if (!ctx) {
    throw new Error("useLocalization must be used inside LocalizationProvider");
  }

  return ctx;
}

export function fmtPosNum(
  num: number,
  decimalMin: number,
  decimalMax: number,
  numFmtInfo: NumberFormatInfo,
): string {
  let n = roundToMaxDecimals(num.toString(), decimalMax);
  n = applyMinDecimals(n, decimalMin);

  const [intStr, fracStr = ""] = n.split(".", 2);
  const groupedInt = groupThousands(intStr, numFmtInfo.thousandSeparator);
  n = fracStr
    ? `${groupedInt}${numFmtInfo.decimalSeparator}${fracStr}`
    : groupedInt;

  return n;
}

function roundToMaxDecimals(numStr: string, maxDecimals: number): string {
  const [intStr, fracStr = ""] = numStr.split(".", 2);

  if (fracStr.length <= maxDecimals) {
    return numStr;
  }

  const cutoff = fracStr.slice(0, maxDecimals);
  const nextDigit = fracStr[maxDecimals];

  if (nextDigit < "5") {
    return intStr + (maxDecimals > 0 ? "." + cutoff : "");
  }

  // 1.235 --> 1.23 --> 123 --> 124 --> 1.24
  // 9.99 --> 9.9 --> 99 --> 100 --> 10.0
  const rounded = BigInt(intStr + cutoff) + 1n;
  const roundedStr = rounded.toString();

  const splitPos = roundedStr.length - maxDecimals;
  const newInt = roundedStr.slice(0, splitPos);
  const newFrac = roundedStr.slice(splitPos).padEnd(maxDecimals, "0");

  return maxDecimals > 0 ? `${newInt}.${newFrac}` : newInt;
}

function applyMinDecimals(numStr: string, minDecimals: number): string {
  if (minDecimals < 0) {
    return numStr;
  }

  const [intStr, fracStr = ""] = numStr.split(".", 2);

  if (fracStr.length >= minDecimals) {
    return numStr;
  }

  const paddedFracStr = fracStr.padEnd(minDecimals, "0");

  return minDecimals > 0 ? `${intStr}.${paddedFracStr}` : intStr;
}

function groupThousands(intStr: string, separator: string): string {
  let result = "";
  let count = 0;

  for (let i = intStr.length - 1; i >= 0; i--) {
    result = intStr[i] + result;
    count++;

    if (count == 3 && i != 0) {
      result = separator + result;
      count = 0;
    }
  }

  return result;
}

export function formatNumber(
  value: number,
  decimalMin: number,
  decimalMax: number,
  fmtInfo: NumberFormatInfo,
): string {
  const pattern = value < 0 ? fmtInfo.numberNegativePattern : "n";
  const n = fmtPosNum(Math.abs(value), decimalMin, decimalMax, fmtInfo);
  return pattern.replace("n", n);
}

export function formatPercent(
  percentage: number,
  decimalMin: number,
  decimalMax: number,
  fmtInfo: NumberFormatInfo,
): string {
  const pattern =
    percentage < 0
      ? fmtInfo.percentNegativePattern
      : fmtInfo.percentPositivePattern;
  const n = fmtPosNum(Math.abs(percentage), decimalMin, decimalMax, fmtInfo);
  return pattern.replace("n", n);
}

export function formatCurrency(
  value: number,
  decimalMin: number,
  decimalMax: number,
  fmtInfo: NumberFormatInfo,
): string {
  const pattern =
    value < 0
      ? fmtInfo.currencyNegativePattern
      : fmtInfo.currencyPositivePattern;
  const n = fmtPosNum(Math.abs(value), decimalMin, decimalMax, fmtInfo);
  return pattern.replace("n", n).replace("$", fmtInfo.currencySymbol);
}

export function formatDate(
  value: string | number | Date,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs.utc(value).local().locale(lang).format(fmtInfo.datePattern);
}

export function formatTime(
  value: string | number | Date,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs.utc(value).local().locale(lang).format(fmtInfo.timePattern);
}

export function formatDateTime(
  value: string | number | Date,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs.utc(value).local().locale(lang).format(fmtInfo.dateTimePattern);
}

export function formatUtcDateTime(
  value: string | number | Date,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs.utc(value).locale(lang).format(fmtInfo.utcDateTimePattern);
}

export function formatIsoDateTime(value: string | number | Date): string {
  return dayjs.utc(value).toISOString();
}

export function formatRelativeTime(
  value: string | number | Date,
  lang: string,
): string {
  return dayjs.utc(value).local().locale(lang).fromNow();
}

export function formatUnixSeconds(
  seconds: number,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs
    .unix(seconds)
    .utc()
    .local()
    .locale(lang)
    .format(fmtInfo.dateTimePattern);
}

export function formatUnixMilliseconds(
  ms: number,
  lang: string,
  fmtInfo: DatetimeFormatInfo,
): string {
  return dayjs.utc(ms).local().locale(lang).format(fmtInfo.dateTimePattern);
}
