import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { ChartSpec, TableSpec } from "./types";

interface ChartRendererProps {
  spec: ChartSpec;
  data: Record<string, unknown>;
}

function applyChartLimit(
  chartData: { labels?: string[]; datasets?: { name?: string; values?: number[] }[] },
  limit?: number,
): { labels: string[]; datasets: { name?: string; values: number[] }[] } {
  if (!limit || limit <= 0 || !chartData.labels) {
    return {
      labels: chartData.labels ?? [],
      datasets: (chartData.datasets ?? []).map((ds) => ({ name: ds.name, values: ds.values ?? [] })),
    };
  }
  const labels = chartData.labels.slice(-limit);
  const datasets = (chartData.datasets ?? []).map((ds) => ({
    name: ds.name,
    values: (ds.values ?? []).slice(-limit),
  }));
  return { labels, datasets };
}

function ChartRenderer({ spec, data }: ChartRendererProps) {
  const raw = data[spec.dataRef] as
    | { labels?: string[]; datasets?: { name?: string; values?: number[] }[] }
    | undefined;

  const option = useMemo(() => {
    if (!raw?.labels || !raw?.datasets) return null;

    const { labels, datasets } = applyChartLimit(raw, spec.limit);

    const colors = ["#0f62fe", "#24a148", "#da1e28", "#8a3ffc", "#ff832b", "#f1c21b"];

    const series = datasets.map((ds, i) => {
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
        data: labels,
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
  }, [raw, spec]);

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

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let val: unknown = obj;
  for (const key of keys) {
    if (val == null || typeof val !== "object") return undefined;
    val = (val as Record<string, unknown>)[key];
  }
  return val;
}

function applyTableFilters(
  rows: Record<string, unknown>[],
  spec: TableSpec,
): Record<string, unknown>[] {
  let result = [...rows];

  if (spec.filterField && spec.filterValue !== undefined && spec.filterValue !== null) {
    const op = spec.filterOp ?? "eq";
    result = result.filter((row) => {
      const val = getNestedValue(row, spec.filterField!);
      if (val === undefined || val === null) return false;
      switch (op) {
        case "eq": return String(val) === String(spec.filterValue);
        case "gt": return Number(val) > Number(spec.filterValue);
        case "lt": return Number(val) < Number(spec.filterValue);
        case "contains": return String(val).toLowerCase().includes(String(spec.filterValue).toLowerCase());
        default: return true;
      }
    });
  }

  if (spec.sortBy) {
    const desc = spec.sortDesc !== false;
    result.sort((a, b) => {
      const va = getNestedValue(a, spec.sortBy!);
      const vb = getNestedValue(b, spec.sortBy!);
      if (va == null) return desc ? 1 : -1;
      if (vb == null) return desc ? -1 : 1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
      return desc ? -cmp : cmp;
    });
  }

  if (spec.limit && spec.limit > 0) {
    result = result.slice(0, spec.limit);
  }

  return result;
}

function TableRenderer({ spec, data }: TableRendererProps) {
  const raw = data[spec.dataRef] as Record<string, unknown>[] | undefined;
  if (!raw || raw.length === 0) return null;

  const rows = applyTableFilters(raw, spec);
  if (rows.length === 0) return null;

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
                  {formatCellValue(getNestedValue(row, col))}
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
