import {
  locale,
  type BaseTranslation,
  type FmtStrParams,
  type HasNodeParam,
  type PathValue,
  type TranslationKeyPath,
  type TranslationSchema,
} from "@/config/localization";
import React, { useMemo, useState, type ReactNode } from "react";

type LangCode = keyof typeof locale;

type TranslationReturn<K extends TranslationKeyPath> =
  HasNodeParam<PathValue<BaseTranslation, K>> extends true
    ? React.ReactNode
    : string;

// This helps the error when you mistype the key (eg. tr("non_existent_key")) will be at the key name itself.
// Though if you continue to type in the second argument, it'd both show the error at the wrong key
// and hint the type of second argument as all the format variables of the translation
type TranslateFunction = {
  <K extends TranslationKeyPath>(
    key: FmtStrParams<PathValue<BaseTranslation, K>> extends undefined
      ? K
      : never,
  ): TranslationReturn<K>;

  <K extends TranslationKeyPath>(
    key: K,
    params: FmtStrParams<PathValue<BaseTranslation, K>>,
  ): TranslationReturn<K>;
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

function reactFromParts(parts: ReactNode[]) {
  return React.createElement(React.Fragment, null, ...parts);
}

function interpolate(
  template: string,
  params: Record<string, unknown>,
): string | React.ReactNode {
  const count = Number(params.count);
  const hasCount = "count" in params && !Number.isNaN(count);

  const parts: React.ReactNode[] = [];

  let lastIndex = 0;
  const regex = /{{(.*?)}}/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(template)) != null) {
    const rawKey = match[1].trim();

    if (match.index > lastIndex) {
      parts.push(template.slice(lastIndex, match.index));
    }

    const plural: PluralSelection = hasCount
      ? tryGetPluralSelection(rawKey)
      : { ok: false };

    if (plural.ok) {
      parts.push(
        count != 1 ? plural.selection.plural : plural.selection.singular,
      );
    } else {
      const value = params[rawKey];

      if (React.isValidElement(value)) {
        parts.push(value);
      } else if (value != null) {
        parts.push(String(value));
      } else {
        parts.push("");
      }
    }

    lastIndex = regex.lastIndex;
  }

  // Add final part
  if (lastIndex < template.length) {
    parts.push(template.slice(lastIndex));
  }

  const hasNode = parts.some((p) => typeof p != "string");

  return hasNode ? reactFromParts(parts) : parts.join("");
}

export function LocalizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [lang, setLang] = useState<LangCode>("en");

  function tr<K extends TranslationKeyPath>(
    key: FmtStrParams<PathValue<BaseTranslation, K>> extends undefined
      ? K
      : never,
  ): TranslationReturn<K>;

  function tr<K extends TranslationKeyPath>(
    key: K,
    params: FmtStrParams<PathValue<BaseTranslation, K>>,
  ): TranslationReturn<K>;

  function tr(
    key: TranslationKeyPath,
    params?: Record<string, unknown>,
  ): string | React.ReactNode {
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
