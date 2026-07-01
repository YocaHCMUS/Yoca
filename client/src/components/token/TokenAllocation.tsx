import React from "react";
import ReactECharts from "echarts-for-react";
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
  const customColors = [
    "#7C3AED", "#2563EB", "#2DD4BF", "#22C55E",
    "#F59E0B", "#EC4899", "#8B5CF6", "#38BDF8", "#A855F7",
  ];

  const displaySymbol = symbol ? symbol.toUpperCase() : "";
  const displayCleanName =
    name && name !== "Unknown Token" ? name.split(" (")[0].trim() : displaySymbol;

  const chartOption = {
    color: customColors,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(11,16,32,0.96)",
      borderColor: "rgba(148,163,184,0.16)",
      textStyle: { color: "#F8FAFC" },
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
        color: "var(--yoca-text-main)",
        rich: {
          name: { color: "var(--yoca-text-muted)", fontSize: 13, width: 190 },
          percent: { color: "var(--yoca-text-main)", fontSize: 13, fontWeight: 600, width: 50, align: "right" },
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
    <div className={styles.container}>
      <h2 className={styles.title}>
        {displayCleanName} ({displaySymbol}) Tokenomics
      </h2>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>
          {displaySymbol} Allocation
        </h3>
        <p className={styles.description}>
          The initial token distribution of {displaySymbol} is as follows:
        </p>

        <div className={styles.chartWrapper}>
          <ReactECharts option={chartOption} style={{ height: "280px", width: "100%" }} />
        </div>
      </div>
    </div>
  );
};
