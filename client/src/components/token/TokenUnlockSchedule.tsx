import React from "react";
import ReactECharts from "echarts-for-react";
import { useUserTheme } from "@/contexts/ThemeContext";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnlockEvent {
  unlock_date: number;
  tokens_to_unlock: number;
  allocation_details: Record<string, number>;
}

interface TokenUnlockScheduleProps {
  symbol: string;
  schedule: UnlockEvent[];
}

// ─── Color palette ────────────────────────────────────────────────────────────

const COLORS = [
  "#7C3AED", "#2563EB", "#2DD4BF", "#22C55E",
  "#F59E0B", "#EC4899", "#8B5CF6", "#38BDF8",
  "#A855F7", "#14B8A6", "#F472B6", "#C084FC",
];

// ─── Build categories + cumulative data ──────────────────────────────────────

function buildChartData(schedule: UnlockEvent[]) {
  const categorySet = new Set<string>();
  schedule.forEach((ev) => Object.keys(ev.allocation_details).forEach((k) => categorySet.add(k)));
  const categories = Array.from(categorySet);

  const sorted = [...schedule].sort((a, b) => a.unlock_date - b.unlock_date);
  const cumulative: Record<string, number> = {};
  categories.forEach((c) => (cumulative[c] = 0));

  const dates: string[] = [];
  const seriesData: Record<string, number[]> = {};
  categories.forEach((c) => (seriesData[c] = []));

  sorted.forEach((ev) => {
    const d = new Date(ev.unlock_date);
    const label = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    dates.push(label);
    categories.forEach((cat) => {
      cumulative[cat] += ev.allocation_details[cat] ?? 0;
      seriesData[cat].push(Math.round(cumulative[cat]));
    });
  });

  const uniqueDates: string[] = [];
  const deduped: Record<string, number[]> = {};
  categories.forEach((c) => (deduped[c] = []));
  dates.forEach((d, i) => {
    if (i === 0 || d !== dates[i - 1]) {
      uniqueDates.push(d);
      categories.forEach((c) => deduped[c].push(seriesData[c][i]));
    } else {
      const last = uniqueDates.length - 1;
      categories.forEach((c) => { deduped[c][last] = Math.max(deduped[c][last], seriesData[c][i]); });
    }
  });

  return { categories, uniqueDates, deduped };
}

// ─── Build ECharts option (no legend — we use custom HTML legend) ─────────────

function buildChartOption(
  categories: string[],
  uniqueDates: string[],
  deduped: Record<string, number[]>,
  isDark: boolean,
): any {
  const textColor = isDark ? "#CBD5E1" : "#475569";
  const gridColor = isDark
    ? "rgba(148,163,184,0.12)"
    : "rgba(148,163,184,0.18)";
  const tooltipBg = isDark ? "rgba(11,16,32,0.96)" : "#ffffff";
  const tooltipBorder = isDark ? "rgba(148,163,184,0.16)" : "rgba(148,163,184,0.24)";

  return {
    color: COLORS,
    legend: { show: false }, // hidden — we render custom HTML legend
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: isDark ? "#e0e0e0" : "#161616", fontSize: 12 },
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return "";
        const date = params[0].axisValue;
        const total = (params as any[]).reduce((s: number, p: any) => s + (p.value || 0), 0);
        const rows = (params as any[])
          .filter((p) => p.value > 0)
          .sort((a, b) => b.value - a.value)
          .map((p) =>
            `<div style="display:flex;justify-content:space-between;gap:24px;margin:2px 0">` +
            `<span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:6px"></span>${p.seriesName}</span>` +
            `<span style="font-weight:600">${(p.value / 1e6).toFixed(2)}M</span></div>`,
          ).join("");
        return (
          `<div style="font-weight:700;margin-bottom:8px">${date}</div>` +
          rows +
          `<div style="border-top:1px solid ${tooltipBorder};margin-top:8px;padding-top:6px;display:flex;justify-content:space-between">` +
          `<span>Total</span><span style="font-weight:700">${(total / 1e6).toFixed(2)}M</span></div>`
        );
      },
    },
    grid: { top: 24, left: 56, right: 24, bottom: 32 },
    xAxis: {
      type: "category",
      data: uniqueDates,
      axisLine: { lineStyle: { color: gridColor } },
      axisLabel: {
        color: textColor,
        fontSize: 11,
        interval: Math.floor(uniqueDates.length / 6),
        formatter: (val: string) => val.split("/")[0],
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: textColor,
        fontSize: 11,
        formatter: (v: number) =>
          v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
          : v >= 1e6 ? `${(v / 1e6).toFixed(0)}M`
          : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
          : String(v),
      },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: categories.map((cat, i) => ({
      name: cat, type: "line", stack: "unlock", smooth: true, symbol: "none",
      lineStyle: { width: 0 }, areaStyle: { opacity: 0.85 },
      itemStyle: { color: COLORS[i % COLORS.length] },
      data: deduped[cat],
    })),
  };
}

// ─── Upcoming unlocks list ────────────────────────────────────────────────────

function UpcomingList({ schedule, isDark }: { schedule: UnlockEvent[]; isDark: boolean }) {
  const now = Date.now();
  const upcoming = schedule
    .filter((ev) => ev.unlock_date >= now)
    .sort((a, b) => a.unlock_date - b.unlock_date)
    .slice(0, 5);

  if (upcoming.length === 0) {
    return <p style={{ color: "var(--yoca-text-muted)", fontSize: "0.875rem", marginTop: "0.5rem" }}>No upcoming unlock events found.</p>;
  }

  const borderColor = "var(--yoca-border)";
  const chipBackground = isDark ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.04)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.75rem" }}>
      {upcoming.map((ev, i) => {
        const date = new Date(ev.unlock_date);
        const daysLeft = Math.ceil((ev.unlock_date - now) / (1000 * 60 * 60 * 24));
        const cats = Object.entries(ev.allocation_details).sort((a, b) => b[1] - a[1]);
        return (
          <div key={i} style={{ border: `1px solid ${borderColor}`, borderRadius: "14px", padding: "0.875rem 1rem", background: "rgba(255,255,255,0.03)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--yoca-text-main)", marginBottom: "0.25rem" }}>
                {date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", fontWeight: 600, color: daysLeft <= 30 ? "var(--yoca-warning)" : "var(--yoca-text-muted)" }}>
                  {daysLeft <= 0 ? "Today" : `in ${daysLeft}d`}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {cats.map(([cat, amount], ci) => (
                  <span key={ci} style={{ fontSize: "0.75rem", color: "var(--yoca-text-soft)", background: chipBackground, borderRadius: "999px", padding: "2px 8px" }}>
                    <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: COLORS[ci % COLORS.length], marginRight: 5, verticalAlign: "middle" }} />
                    {cat}: {amount >= 1e6 ? `${(amount / 1e6).toFixed(2)}M` : amount >= 1e3 ? `${(amount / 1e3).toFixed(1)}K` : amount.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
              <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--yoca-text-main)" }}>
                {ev.tokens_to_unlock >= 1e9 ? `${(ev.tokens_to_unlock / 1e9).toFixed(2)}B` : ev.tokens_to_unlock >= 1e6 ? `${(ev.tokens_to_unlock / 1e6).toFixed(2)}M` : ev.tokens_to_unlock >= 1e3 ? `${(ev.tokens_to_unlock / 1e3).toFixed(1)}K` : ev.tokens_to_unlock.toFixed(0)}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--yoca-text-muted)" }}>tokens unlock</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const TokenUnlockSchedule = ({ symbol, schedule }: TokenUnlockScheduleProps) => {
  const { theme } = useUserTheme();
  const isDark = theme === "dark";
  const displaySymbol = symbol?.toUpperCase() ?? "";
  const borderColor = "var(--yoca-border)";

  const { categories, uniqueDates, deduped } = buildChartData(schedule);
  const chartOption = buildChartOption(categories, uniqueDates, deduped, isDark);

  return (
    <div style={{ padding: "0.5rem 0" }}>
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: "14px", padding: "1.5rem", marginBottom: "1.5rem", background: "rgba(255,255,255,0.03)" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.25rem", color: "var(--yoca-text-main)" }}>
          {displaySymbol} Unlock Schedule
        </h3>
        <p style={{ color: "var(--yoca-text-muted)", fontSize: "0.875rem", marginBottom: "1.25rem" }}>
          Cumulative token unlock by allocation group over time
        </p>

        {/* Chart — no built-in legend */}
        <ReactECharts option={chartOption} style={{ height: "300px", width: "100%" }} notMerge />

        {/* Custom HTML legend that wraps naturally */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5rem 1.25rem",
          marginTop: "1rem",
          paddingTop: "0.75rem",
          borderTop: `1px solid ${borderColor}`,
        }}>
          {categories.map((cat, i) => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "var(--yoca-text-muted)" }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
              {cat}
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming events */}
      <div style={{ border: `1px solid ${borderColor}`, borderRadius: "14px", padding: "1.5rem", background: "rgba(255,255,255,0.03)" }}>
        <h3 style={{ fontSize: "1.125rem", fontWeight: 700, marginBottom: "0.125rem", color: "var(--yoca-text-main)" }}>Upcoming Unlocks</h3>
        <p style={{ color: "var(--yoca-text-muted)", fontSize: "0.875rem" }}>
          Next {Math.min(5, schedule.filter((e) => e.unlock_date >= Date.now()).length)} scheduled unlock events
        </p>
        <UpcomingList schedule={schedule} isDark={isDark} />
      </div>
    </div>
  );
};
