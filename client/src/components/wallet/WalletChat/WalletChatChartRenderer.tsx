import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { ChartSpec, TableFilter, TableSpec } from "./types";

interface ChartRendererProps {
  spec: ChartSpec;
  data: Record<string, unknown>;
  onAction?: (href: string) => void;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
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

function ChartRenderer({ spec, data, onAction }: ChartRendererProps) {
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

    const tooltip: Record<string, unknown> = {
      trigger: "axis",
      backgroundColor: "rgba(22,22,22,0.95)",
      borderColor: "#333",
      textStyle: { color: "#fff", fontSize: 11 },
    };

    if (spec.pointActions) {
      tooltip.formatter = (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const p = arr[0] as { axisValueLabel?: string } | undefined;
        const label = p?.axisValueLabel ?? "";
        const query = interpolate(spec.pointActions!.query, { label });
        const lines = arr.map((pt: unknown) => {
          const seriesName = (pt as { seriesName?: string }).seriesName ?? "";
          const value = (pt as { value?: number[] }).value;
          const v = Array.isArray(value) ? value[1] ?? value[0] : value;
          return `${seriesName}: ${v}`;
        });
        return `${lines.join("<br/>")}<br/><span style="color:#2a6df4;font-size:10px">Click to ask: ${query}</span>`;
      };
    }

    return {
      backgroundColor: "transparent",
      color: colors,
      grid: { left: 40, right: 8, top: 24, bottom: 24 },
      tooltip,
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

  const onEvents = useMemo(() => {
    if (!spec.pointActions || !onAction || !raw?.labels) return undefined;
    return {
      click: (params: { dataIndex?: number }) => {
        const idx = params.dataIndex;
        if (idx == null) return;
        const label = raw.labels?.[idx] ?? "";
        const query = interpolate(spec.pointActions!.query, { label });
        onAction(query);
      },
    };
  }, [spec.pointActions, onAction, raw?.labels]);

  if (!option) return null;

  return (
    <div style={{ width: "100%", height: 200, margin: "8px 0" }}>
      {spec.title && (
        <div style={{ fontSize: 12, fontWeight: 600, color: "#ccc", marginBottom: 4 }}>
          {spec.title}
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ height: 180 }}
        onEvents={onEvents}
      />
    </div>
  );
}

type ColumnFormat = "currency" | "decimal" | "percent" | "address" | "datetime" | "date" | "time" | "relative" | "text";

interface ParsedColumn {
  field: string;
  title: string;
  format: ColumnFormat;
}

function detectFormat(field: string): ColumnFormat {
  const lower = field.toLowerCase();
  if (/usd|price|value|pnl|pn_l|volume|fee$/i.test(lower)) return "currency";
  if (/percent|rate|change|winrate|win_rate|ratio$/i.test(lower)) return "percent";
  if (/at$|time|date/i.test(lower)) return "datetime";
  if (/address|hash|signature/i.test(lower)) return "address";
  return "decimal";
}

function parseColumns(columns: string): ParsedColumn[] {
  return columns.split(",").map((entry) => {
    const parts = entry.trim().split(":");
    const field = parts[0]!.trim();
    const title = parts[1]?.trim() || field;
    const format = (parts[2]?.trim() as ColumnFormat) || detectFormat(field);
    return { field, title, format };
  });
}

interface TableRendererProps {
  spec: TableSpec;
  data: Record<string, unknown>;
  onAction?: (href: string) => void;
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

function matchFilter(val: unknown, filter: TableFilter): boolean {
  if (val === undefined || val === null) return false;
  switch (filter.op) {
    case "eq": return String(val) === String(filter.value);
    case "gt": return Number(val) > Number(filter.value);
    case "lt": return Number(val) < Number(filter.value);
    case "contains": return String(val).toLowerCase().includes(String(filter.value).toLowerCase());
    default: return true;
  }
}

function applyTableFilters(
  rows: Record<string, unknown>[],
  spec: TableSpec,
): Record<string, unknown>[] {
  let result = [...rows];

  if (spec.filters?.length) {
    const mode = spec.filterMode ?? "and";
    if (mode === "or") {
      result = result.filter((row) =>
        spec.filters!.some((f) => matchFilter(getNestedValue(row, f.field), f)),
      );
    } else {
      for (const f of spec.filters) {
        result = result.filter((row) => matchFilter(getNestedValue(row, f.field), f));
      }
    }
  } else if (spec.filterField && spec.filterValue !== undefined && spec.filterValue !== null) {
    const op = spec.filterOp ?? "eq";
    result = result.filter((row) => {
      const val = getNestedValue(row, spec.filterField!);
      return matchFilter(val, { field: spec.filterField!, value: spec.filterValue, op });
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

function formatCellValue(val: unknown, format: ColumnFormat, fmt: ReturnType<typeof useLocalization>["fmt"]): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "string") {
    if (format === "address") return fmt.text.address(val);
    if (format === "text") return val;
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim() !== "") {
      return formatCellValue(num, format, fmt);
    }
    if (format === "datetime" || format === "date" || format === "time" || format === "relative") {
      const ms = new Date(val).getTime();
      if (!Number.isNaN(ms)) return formatCellValue(ms, format, fmt);
    }
    return val;
  }
  if (typeof val === "number") {
    switch (format) {
      case "currency": return fmt.num.currency(val);
      case "percent": return fmt.num.percentagePoint(val);
      case "decimal": return fmt.num.decimal(val);
      case "datetime": {
        const ms = typeof val === "string" ? new Date(val).getTime() : val;
        if (Number.isNaN(ms)) return String(val);
        return fmt.datetime.fromUnixMilliseconds(ms);
      }
      case "date": {
        const d = typeof val === "string" ? new Date(val).getTime() : val;
        if (Number.isNaN(d)) return String(val);
        return fmt.datetime.date(d);
      }
      case "time": {
        const t = typeof val === "string" ? new Date(val).getTime() : val;
        if (Number.isNaN(t)) return String(val);
        return fmt.datetime.time(t);
      }
      case "relative": {
        const r = typeof val === "string" ? new Date(val).getTime() : val;
        if (Number.isNaN(r)) return String(val);
        return fmt.datetime.relative(r);
      }
      case "address":
      case "text":
      default: return String(val);
    }
  }
  return String(val);
}

function TableRenderer({ spec, data, onAction }: TableRendererProps) {
  const { fmt } = useLocalization();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const raw = data[spec.dataRef];
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const rows = applyTableFilters(raw, spec);
  if (rows.length === 0) return null;

  const cols = parseColumns(spec.columns);

  function resolveRowVars(row: Record<string, unknown>): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const col of cols) {
      const val = getNestedValue(row, col.field);
      vars[col.field] = val != null ? String(val) : "";
    }
    return vars;
  }

  return (
    <div style={{ width: "100%", margin: "8px 0", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            {cols.map((col) => (
              <th
                key={col.field}
                style={{
                  textAlign: "left",
                  padding: "4px 8px",
                  borderBottom: "1px solid #333",
                  color: "#888",
                  fontWeight: 600,
                  textTransform: "capitalize",
                }}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowVars = spec.rowActions ? resolveRowVars(row) : undefined;
            const rowQuery = rowVars && spec.rowActions
              ? interpolate(spec.rowActions.query, rowVars)
              : null;
            const rowTooltip = rowQuery ? `Click to ask: ${rowQuery}` : undefined;

            return (
              <tr
                key={i}
                title={rowTooltip}
                onClick={rowQuery && onAction ? () => onAction(rowQuery!) : undefined}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  cursor: rowQuery && onAction ? "pointer" : undefined,
                  background: hoveredIdx === i && rowQuery ? "#2a2a2a" : undefined,
                  transition: "background 0.15s",
                }}
              >
                {cols.map((col) => (
                  <td
                    key={col.field}
                    style={{
                      padding: "4px 8px",
                      borderBottom: "1px solid #222",
                      color: "#ccc",
                    }}
                  >
                    {formatCellValue(getNestedValue(row, col.field), col.format, fmt)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { ChartRenderer, TableRenderer };
