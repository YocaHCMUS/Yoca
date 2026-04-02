import { useUserTheme } from "@/contexts/ThemeContext";
import { useEffect, useState } from "react";

export function useCarbonTokens<T extends Record<string, string>>(tokens: T) {
  const { themeRef } = useUserTheme();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!themeRef.current) return;

    const resolved: Record<string, string> = {};

    for (const key in tokens) {
      const varName = extractVarName(tokens[key]);
      if (varName) {
        resolved[key] = getComputedStyle(themeRef.current)
          .getPropertyValue(varName)
          .trim();
      }
    }

    setValues(resolved);
  });

  return values as { [K in keyof T]: string };
}

function extractVarName(token: string) {
  const match = token.match(/var\((--[^)]+)\)/);
  return match?.[1];
}
