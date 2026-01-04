import { useMemo } from "react";
import type { ThemeMode } from "../contexts/ThemeContext";
import { useTheme } from "../contexts/ThemeContext";

export interface ChartThemeConfig {
  backgroundColor: string;
  textColor: string;
  textColorSecondary: string;
  borderColor: string;
  tooltipBgColor: string;
  tooltipBorderColor: string;
  axisLineColor: string;
  splitLineColor: string;
  colorPalette: string[];
}

const LIGHT_THEME: ChartThemeConfig = {
  backgroundColor: "#ffffff",
  textColor: "#161616",
  textColorSecondary: "#525252",
  borderColor: "#e0e0e0",
  tooltipBgColor: "rgba(255, 255, 255, 0.95)",
  tooltipBorderColor: "#e0e0e0",
  axisLineColor: "#e0e0e0",
  splitLineColor: "#f4f4f4",
  colorPalette: [
    "#0f62fe",
    "#24a148",
    "#da1e28",
    "#8a3ffc",
    "#ff832b",
    "#f1c21b",
    "#08bdba",
    "#d12771",
    "#491d8b",
    "#002d9c",
  ],
};

const DARK_THEME: ChartThemeConfig = {
  backgroundColor: "#161616",
  textColor: "#f4f4f4",
  textColorSecondary: "#c6c6c6",
  borderColor: "#393939",
  tooltipBgColor: "rgba(38, 38, 38, 0.95)",
  tooltipBorderColor: "#525252",
  axisLineColor: "#393939",
  splitLineColor: "#262626",
  colorPalette: [
    "#4589ff",
    "#42be65",
    "#ff8389",
    "#be95ff",
    "#ff9d57",
    "#f1c21b",
    "#3ddbd9",
    "#ee5396",
    "#a56eff",
    "#408bfc",
  ],
};

function getThemeConfig(theme: ThemeMode): ChartThemeConfig {
  return theme === "dark" ? DARK_THEME : LIGHT_THEME;
}

export function useChartTheme(): ChartThemeConfig {
  const { theme } = useTheme();

  return useMemo(() => getThemeConfig(theme), [theme]);
}

export function getThemedChartBaseOption(themeConfig: ChartThemeConfig) {
  return {
    backgroundColor: themeConfig.backgroundColor,
    color: themeConfig.colorPalette,
    textStyle: {
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 12,
      color: themeConfig.textColor,
    },
    title: {
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: themeConfig.textColor,
      },
    },
    tooltip: {
      backgroundColor: themeConfig.tooltipBgColor,
      borderColor: themeConfig.tooltipBorderColor,
      borderWidth: 1,
      textStyle: {
        color: themeConfig.textColor,
      },
    },
    legend: {
      textStyle: {
        color: themeConfig.textColorSecondary,
      },
    },
    xAxis: {
      axisLine: {
        lineStyle: {
          color: themeConfig.axisLineColor,
        },
      },
      axisLabel: {
        color: themeConfig.textColorSecondary,
      },
      splitLine: {
        lineStyle: {
          color: themeConfig.splitLineColor,
        },
      },
    },
    yAxis: {
      axisLine: {
        lineStyle: {
          color: themeConfig.axisLineColor,
        },
      },
      axisLabel: {
        color: themeConfig.textColorSecondary,
      },
      splitLine: {
        lineStyle: {
          color: themeConfig.splitLineColor,
        },
      },
    },
  };
}
