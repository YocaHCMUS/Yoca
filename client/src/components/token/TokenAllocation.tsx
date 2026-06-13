import React from "react";
import ReactECharts from "echarts-for-react";
import { useUserTheme } from "@/contexts/ThemeContext";
import styles from "./TokenAllocation.module.scss";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllocationItem {
  percentage: number;
  name: string;
}

interface TokenAllocationProps {
  symbol: string;
  name?: string;
  distribution: AllocationItem[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TokenAllocation = ({ symbol, name, distribution }: TokenAllocationProps) => {
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const textColor = isDark ? "#f4f4f4" : "#161616";
  const textSecondaryColor = isDark ? "#c6c6c6" : "#525252";

  const customColors = [
    "#D15B40", "#EE9F43", "#F8DE5B", "#F3AD8E",
    "#D74F71", "#F08CB1", "#F7D0DF", "#B385D5", "#DFCAEF",
  ];

  const displaySymbol = symbol ? symbol.toUpperCase() : "";
  const displayCleanName =
    name && name !== "Unknown Token" ? name.split(" (")[0].trim() : displaySymbol;

  const chartOption = {
    color: customColors,
    tooltip: {
      trigger: "item",
      backgroundColor: "var(--cds-layer)",
      borderColor: "var(--cds-border-subtle)",
      textStyle: { color: "var(--cds-text-primary)" },
      formatter: "{b}: <span style=\"font-weight: bold\">{c}%</span>",
    },
    legend: {
      orient: "vertical",
      right: "5%",
      top: "center",
      icon: "circle",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 16,
      formatter: function (legendName: string) {
        const item = distribution.find((i) => i.name === legendName);
        if (!item) return legendName;
        let displayName = legendName;
        if (displayName.length > 20) displayName = displayName.substring(0, 18) + "...";
        return `{name|${displayName}}{percent|${item.percentage.toFixed(2)}%}`;
      },
      textStyle: {
        color: textColor,
        rich: {
          name: { color: textSecondaryColor, fontSize: 13, width: 190 },
          percent: { color: textColor, fontSize: 13, fontWeight: 600, width: 50, align: "right" },
        },
      },
    },
    series: [
      {
        name: "Allocation",
        type: "pie",
        radius: ["45%", "70%"],
        center: ["30%", "50%"],
        avoidLabelOverlap: false,
        itemStyle: { borderWidth: 0 },
        label: { show: false },
        emphasis: { focus: "self", label: { show: false } },
        labelLine: { show: false },
        data: distribution.map((item) => ({ value: item.percentage, name: item.name })),
      },
    ],
  };

  return (
    <div style={{ padding: "0.5rem 0" }}>
      <h2
        style={{
          fontSize: "1.25rem",
          fontWeight: 600,
          marginBottom: "1rem",
          color: "var(--cds-text-primary)",
        }}
      >
        {displayCleanName} ({displaySymbol}) Tokenomics
      </h2>

      <div
        style={{
          border: "1px solid var(--cds-border-subtle)",
          borderRadius: "8px",
          padding: "1.5rem",
          backgroundColor: "var(--cds-ui-background, #ffffff)",
        }}
      >
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            marginBottom: "0.25rem",
            color: "var(--cds-text-primary)",
          }}
        >
          {displaySymbol} Allocation
        </h3>
        <p
          style={{
            color: "var(--cds-text-secondary)",
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
          }}
        >
          The initial token distribution of {displaySymbol} is as follows:
        </p>

        <div className={styles.chartWrapper}>
          <ReactECharts option={chartOption} style={{ height: "280px", width: "100%" }} />
        </div>
      </div>
    </div>
  );
};
