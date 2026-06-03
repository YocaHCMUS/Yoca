import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { ChartSpec, TableSpec } from "./types";

interface ChartRendererProps {
  spec: ChartSpec;
  data: Record<string, unknown>;
}

function ChartRenderer({ spec, data }: ChartRendererProps) {
  const chartData = data[spec.dataRef] as
    | { labels?: string[]; datasets?: { name?: string; values?: number[] }[] }
    | undefined;

  const option = useMemo(() => {
    if (!chartData?.labels || !chartData?.datasets) return null;

    const colors = ["#0f62fe", "#24a148", "#da1e28", "#8a3ffc", "#ff832b", "#f1c21b"];

    const series = chartData.datasets.map((ds, i) => {
      const base: Record<string, unknown> = {
        name: ds.name ?? `Series ${i + 1}`,
        type: spec.type === "area" ? "line" : spec.type,
        data: ds.values ?? [],
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2 },
      };

      if (spec.type === "area") {
        base.areaStyle = {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors[i % colors.length] + "40" },
              { offset: 1, color: colors[i % colors.length] + "05" },
            ],
          },
        };
      }

      return base;
    });

    return {
      backgroundColor: "transparent",
      color: colors,
      grid: { left: 40, right: 8, top: 24, bottom: 24 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(22,22,22,0.95)",
        borderColor: "#333",
        textStyle: { color: "#fff", fontSize: 11 },
      },
      xAxis: {
        type: "category",
        data: chartData.labels,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10, color: "#888" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#2a2a2a", type: "dashed" } },
        axisLabel: { fontSize: 10, color: "#888" },
      },
      series,
    };
  }, [chartData, spec]);

  if (!option) return null;

  return (
    <div style={{ width: "100%", height: 200, margin: "8px 0" }}>
      {spec.title && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "#ccc", marginBottom: 4 }}>
          {spec.title}
        </div>
      )}
      <ReactECharts option={option} style={{ height: 180 }} />
    </div>
  );
}

interface TableRendererProps {
  spec: TableSpec;
  data: Record<string, unknown>;
}

function TableRenderer({ spec, data }: TableRendererProps) {
  const rows = data[spec.dataRef] as Record<string, unknown>[] | undefined;
  if (!rows || rows.length === 0) return null;

  const cols = spec.columns.split(",").map((c) => c.trim());

  return (
    <div style={{ width: "100%", margin: "8px 0", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col}
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  borderBottom: "1px solid #333",
                  color: "#888",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {cols.map((col) => (
                <td
                  key={col}
                  style={{
                    padding: "4px 8px",
                    borderBottom: "1px solid #222",
                    color: "#ccc",
                  }}
                >
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(2)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(2)}K`;
    if (Math.abs(val) >= 1) return `$${val.toFixed(2)}`;
    return val.toFixed(4);
  }
  return String(val);
}

export { ChartRenderer, TableRenderer };
