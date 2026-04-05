import { THEME_LOCAL_STORAGE_KEY } from "@/config/constants";
import { GlobalTheme, Theme } from "@carbon/react";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react";

type SupportedTheme = ComponentProps<typeof Theme>["theme"];
const userThemes = {
  light: "white",
  dark: "g100",
} as const satisfies Record<string, SupportedTheme>;
export type ThemeMode = keyof typeof userThemes;

function isValidTheme(value: string): value is ThemeMode {
  return Object.keys(userThemes).includes(value);
}

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  themeRef: RefObject<HTMLDivElement | null>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
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

  const themeRef = useRef<HTMLDivElement>(null);

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
        themeRef,
      }}
    >
      <GlobalTheme theme={userThemes[theme]}>
        <Theme theme={userThemes[theme]} style={{ minHeight: "100vh" }}>
          <div ref={themeRef} data-carbon-theme>
            {children}
          </div>
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
