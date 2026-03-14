import { THEME_LOCAL_STORAGE_KEY } from "@/config/constants";
import { GlobalTheme, Theme } from "@carbon/react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ComponentProps,
} from "react";

type SupportedTheme = ComponentProps<typeof Theme>["theme"];
const userThemes = {
  light: "white",
  dark: "g100",
} as const satisfies Record<string, SupportedTheme>;
type ThemeMode = keyof typeof userThemes;

function isValidTheme(value: string): value is ThemeMode {
  return Object.keys(userThemes).includes(value);
}

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
}

function getInitialTheme(): ThemeMode {
  const previousTheme = localStorage.getItem(THEME_LOCAL_STORAGE_KEY);
  if (previousTheme && isValidTheme(previousTheme)) {
    return previousTheme;
  }
  return "light";
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    localStorage.setItem(THEME_LOCAL_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => (prevTheme == "light" ? "dark" : "light"));
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme,
      }}
    >
      <GlobalTheme theme={userThemes[theme]}>
        <Theme theme={userThemes[theme]} style={{ minHeight: "100vh" }}>
          {children}
        </Theme>
      </GlobalTheme>
    </ThemeContext.Provider>
  );
};

export function useUserTheme() {
  const context = useContext(ThemeContext);
  if (context == undefined) {
    throw new Error("useUserTheme must be used within a ThemeProvider");
  }
  return context;
}
