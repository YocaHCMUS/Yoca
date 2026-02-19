import {
  locale,
  type BaseTranslation,
  type FmtStrParams,
  type PathValue,
  type TranslationKeyPath,
  type TranslationSchema,
  type WithBase,
} from "@/config/localization";
import React, { useMemo, useState } from "react";

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

type NumberFormatter = typeof locale.en.format.num;
type DatetimeFormatter = typeof locale.en.format.datetime;

type Formatter = {
  num: NumberFormatter;
  datetime: DatetimeFormatter;
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

  const fmt = useMemo<Formatter>(() => {
    return {
      num: locale[lang].format.num,
      datetime: locale[lang].format.datetime,
    };
  }, [lang]);

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
