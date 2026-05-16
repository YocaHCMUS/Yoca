import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { cds } from "./carbon-theme";

export const CHART_COLOR_PALETTE = [
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
];

export function useCarbonChartBaseOption() {
  const tokens = useCarbonTokens({
    textPrimary: cds.textPrimary,
    textSecondary: cds.textSecondary,
    textHelper: cds.textHelper,
    tooltipBg: cds.backgroundInverse,
    tooltipText: cds.textInverse,
    borderSubtle: cds.borderSubtle00,
    splitLine: cds.borderSubtle00,
    axisLine: cds.borderSubtle00,
    layer: cds.layer02,
    interactive: cds.interactive,
  });

  return {
    backgroundColor: "transparent",
    color: CHART_COLOR_PALETTE,
    textStyle: {
      fontFamily: "'IBM Plex Sans', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 12,
      color: tokens.textPrimary,
    },
    title: {
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: tokens.textPrimary,
      },
    },
    tooltip: {
      backgroundColor: tokens.tooltipBg,
      borderColor: "transparent",
      borderWidth: 0,
      borderRadius: 4,
      padding: [8, 12],
      textStyle: { color: tokens.tooltipText, fontSize: 12 },
    },
    legend: {
      textStyle: { color: tokens.textSecondary },
      backgroundColor: tokens.layer,
      padding: 8,
      borderRadius: 4,
    },
    grid: {
      left: "1rem",
      right: "1rem",
      bottom: "1.5rem",
      top: "1.5rem",
      containLabel: true,
    },
    xAxis: {
      axisLine: { show: true, lineStyle: { color: tokens.axisLine } },
      axisTick: { show: true },
      axisLabel: { color: tokens.textSecondary, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: tokens.splitLine, type: "dashed" as const } },
    },
    yAxis: {
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tokens.textSecondary, fontSize: 11 },
      splitLine: { show: true, lineStyle: { color: tokens.splitLine, type: "dashed" as const } },
    },
  };
}
