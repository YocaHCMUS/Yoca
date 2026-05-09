import { useUserTheme } from "@/contexts/ThemeContext";
import { useMemo } from "react";

export function useCarbonTokens<T extends Record<string, string>>(tokens: T) {
  const { theme, themeRef } = useUserTheme();

  const values = useMemo(() => {
    if (!themeRef.current) {
      return {} as { [K in keyof T]: string };
    }

    const resolved: Record<string, string> = {};

    for (const key in tokens) {
      const varName = extractVarName(tokens[key]);

      if (varName) {
        resolved[key] = getComputedStyle(themeRef.current)
          .getPropertyValue(varName)
          .trim();
      }
    }

    return resolved as { [K in keyof T]: string };
  }, [theme, tokens]);

  return values;
}

function extractVarName(token: string) {
  const match = token.match(/var\((--[^)]+)\)/);
  return match?.[1];
}
