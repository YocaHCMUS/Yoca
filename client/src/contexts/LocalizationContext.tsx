import {
  translations,
  type FmtStrParams,
  type KeyPath,
  type PathValue,
  type Schema,
} from "@/config/translations";
import React, { useState } from "react";

type LangCode = keyof typeof translations;

type LocalizationContextType = {
  lang: LangCode;
  setLang: React.Dispatch<React.SetStateAction<LangCode>>;
  tr: <Path extends KeyPath>(
    key: Path,
    ...args: FmtStrParams<PathValue<Schema, Path>> extends undefined
      ? []
      : [params: FmtStrParams<PathValue<Schema, Path>>]
  ) => string;
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

// Safe any as path is already enforced
function get(obj: any, path: string) {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
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
      return count !== 1 ? res.selection.plural : res.selection.singular;
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

  function tr<K extends KeyPath>(
    key: K,
    ...args: FmtStrParams<PathValue<Schema, K>> extends undefined
      ? []
      : [params: FmtStrParams<PathValue<Schema, K>>]
  ): string {
    const template = get(translations[lang], key);
    const params = args[0];

    if (params) {
      return interpolate(template, params);
    }

    return template;
  }

  return (
    <LocalizationContext.Provider value={{ lang, setLang, tr }}>
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
