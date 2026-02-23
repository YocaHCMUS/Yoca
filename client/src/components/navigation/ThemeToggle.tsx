import { useUserTheme } from "@/contexts";
import { Asleep, Light } from "@carbon/icons-react";
import { HeaderGlobalAction } from "@carbon/react";
import React from "react";
import styles from "./ThemeToggle.module.scss";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useUserTheme();

  return (
    <div className={styles.themeToggleWrapper}>
      <HeaderGlobalAction
        aria-label={`Switch to ${theme == "dark" ? "light" : "dark"} mode`}
        tooltipAlignment="end"
        onClick={toggleTheme}
        className={styles.themeToggle}
      >
        {theme == "dark" ? <Light size={20} /> : <Asleep size={20} />}
      </HeaderGlobalAction>
    </div>
  );
};

export default ThemeToggle;
