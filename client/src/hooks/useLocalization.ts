import { useState } from "react";

const lang = {
  en: "English-US",
  vi: "Vietnamese",
} as const;

type LangCode = keyof typeof lang;

function useLocalization() {
  const [lang, setLang] = useState<LangCode>("en");

  return setLang;
}
