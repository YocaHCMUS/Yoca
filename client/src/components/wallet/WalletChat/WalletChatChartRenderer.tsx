import { useMemo, useState, useRef, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonChartBaseOption, CHART_COLOR_PALETTE } from "@/util/carbon-chart-base";
import type { ChartSpec, TableFilter, TableSpec } from "./types";
import styles from "./WalletChat.module.scss";

const TABLE_PAGE_SIZE = 10;

interface ChartRendererProps {
  spec: ChartSpec;
  data: Record<string, unknown>;
  onAction?: (href: string) => void;
}

function interpolate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{([\w.]+)\}/g, (_, k: string) => vars[k] ?? `{${k}}`);
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

function formatYValue(val: number, format: NonNullable<ChartSpec["yAxisFormat"]>, fmt: ReturnType<typeof useLocalization>["fmt"]): string {
  switch (format) {
    case "currency": return fmt.num.currency(val);
    case "compact-currency": return fmt.num.compact.currency(val);
    case "percent": return fmt.num.percentagePoint(val * 100);
    case "decimal":
    default: return fmt.num.decimal(val);
  }
}

function formatXValue(val: number, format: NonNullable<ChartSpec["xAxisFormat"]>, fmt: ReturnType<typeof useLocalization>["fmt"]): string {
  switch (format) {
    case "datetime": return fmt.datetime.fromUnixMilliseconds(val);
    case "date": return fmt.datetime.date(val);
    case "time": return fmt.datetime.time(val);
    default: return fmt.datetime.fromUnixMilliseconds(val);
  }
}

function ChartRenderer({ spec, data, onAction }: ChartRendererProps) {
  const raw = data[spec.dataRef] as
    | { labels?: string[]; datasets?: { name?: string; values?: number[] }[] }
    | undefined;
  const { tr, fmt } = useLocalization();
  const baseOption = useCarbonChartBaseOption();
  const chartRef = useRef<ReactECharts>(null);

  const option = useMemo(() => {
    if (!raw?.labels || !raw?.datasets) return null;

    const { labels, datasets } = applyChartLimit(raw, spec.limit);

    const colors = CHART_COLOR_PALETTE;

    const isPie = spec.type === "pie";
    const isTimeAxis = spec.xAxisType === "time";
    const shouldTruncate = isTimeAxis && labels.length > 15;

    const yAxisFmt = spec.yAxisFormat;
    const yAxisLabel = yAxisFmt
      ? (val: number) => formatYValue(val, yAxisFmt, fmt)
      : undefined;

    const xAxisFmt = spec.xAxisFormat;
    const xAxisLabel = isTimeAxis && xAxisFmt
      ? (val: number) => formatXValue(val, xAxisFmt, fmt)
      : undefined;

    const tooltip: Record<string, unknown> = {
      trigger: isPie ? "item" : "axis",
    };

    if (isPie && spec.pointActions) {
      tooltip.formatter = (params: unknown) => {
        const p = params as { name?: string; value?: number } | undefined;
        const label = p?.name ?? "";
        const value = p?.value ?? 0;
        const formatted = yAxisFmt
          ? formatYValue(value, yAxisFmt, fmt)
          : value;
        const query = interpolate(spec.pointActions!.query, { label, date: label, x: label });
        return `${label}: ${formatted}<br/><span style="color:#2a6df4;font-size:10px">${tr("chat.clickToAsk", { query })}</span>`;
      };
    }

    if (!isPie) {
      tooltip.formatter = (params: unknown) => {
        const arr = Array.isArray(params) ? params : [params];
        const p = arr[0] as { axisValue?: number; axisValueLabel?: string; dataIndex?: number } | undefined;

        const xLabel = isTimeAxis
          ? formatXValue(p?.axisValue ?? 0, xAxisFmt ?? "datetime", fmt)
          : (p?.axisValueLabel ?? "");

        const clickLine = spec.pointActions
          ? (() => {
            const label = p?.axisValueLabel ?? (p?.dataIndex != null ? labels[p.dataIndex] ?? "" : "");
            const query = interpolate(spec.pointActions!.query, { label, date: label, x: label });
            return `<br/><span style="color:#2a6df4;font-size:10px">${tr("chat.clickToAsk", { query })}</span>`;
          })()
          : "";

        const lines = arr.map((pt: unknown) => {
          const seriesName = (pt as { seriesName?: string }).seriesName ?? "";
          const value = (pt as { value?: number[] }).value;
          const v = Array.isArray(value) ? value[1] ?? value[0] ?? 0 : (value ?? 0);
          const formatted = yAxisFmt
            ? formatYValue(v, yAxisFmt, fmt)
            : v;
          return `${seriesName}: ${formatted}`;
        });

        return `${xLabel}<br/>${lines.join("<br/>")}${clickLine}`;
      };
    }

    if (isPie) {
      const ds = datasets[0];
      return {
        ...baseOption,
        color: colors,
        xAxis: undefined,
        yAxis: undefined,
        tooltip,
        series: [{
          type: "pie",
          radius: ["40%", "70%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          itemStyle: { borderRadius: 4, borderColor: "transparent", borderWidth: 2 },
          label: { show: true, position: "outside", fontSize: 10, color: "#ccc", formatter: "{b}" },
          emphasis: { label: { show: true, fontSize: 12, fontWeight: "bold" } },
          data: labels.map((label, i) => ({
            name: label,
            value: ds?.values?.[i] ?? 0,
          })),
          animationDuration: 500,
        }],
      };
    }

    const series = datasets.map((ds, i) => {
      const hasClick = !!spec.pointActions;
      const base: Record<string, unknown> = {
        name: ds.name ?? tr("chat.seriesLabel", { count: i + 1 }),
        type: spec.type === "area" ? "line" : spec.type,
        data: ds.values ?? [],
        smooth: false,
        symbol: hasClick && labels.length <= 60 ? "emptyCircle" : "none",
        ...(hasClick && labels.length <= 60 ? { symbolSize: 6 } : {}),
        lineStyle: { width: 2 },
      };

      if (spec.type === "area") {
        base.areaStyle = {
          color: {
            type: "linear",
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: colors[i % colors.length] + "4D" },
              { offset: 1, color: colors[i % colors.length] + "0D" },
            ],
          },
        };
      }

      return base;
    });

    return {
      ...baseOption,
      color: colors,
      tooltip,
      grid: {
        left: 10,
        right: 10,
        top: 20,
        bottom: 30,
        containLabel: true,
      },
      xAxis: {
        ...baseOption.xAxis,
        type: isTimeAxis ? "time" : "category",
        ...(isTimeAxis ? {} : { data: labels }),
        axisLabel: {
          ...baseOption.xAxis?.axisLabel,
          color: baseOption.textStyle?.color,
          formatter: xAxisLabel,
          hideOverlap: true,
          ...(shouldTruncate ? { rotate: 45 } : {}),
        },
      },
      yAxis: {
        ...baseOption.yAxis,
        type: "value",
        position: "right",
        axisLabel: {
          ...baseOption.yAxis?.axisLabel,
          formatter: yAxisLabel,
        },
      },
      series,
    };
  }, [raw, spec, fmt, tr, baseOption]);

  useEffect(() => {
    if (!spec.pointActions || !onAction || !raw?.labels) return;
    if (!chartRef.current) return;
    const { labels } = applyChartLimit(raw, spec.limit);
    if (labels.length === 0) return;
    const chart = chartRef.current.getEchartsInstance();
    const handler = (params: { dataIndex?: number }) => {
      const idx = params.dataIndex;
      if (idx == null || idx >= labels.length) return;
      const label = labels[idx] ?? "";
      const query = interpolate(spec.pointActions!.query, { label, date: label, x: label });
      onAction(query);
    };
    chart.on("click", handler);
    return () => { chart.off("click", handler); };
  }, [spec.pointActions, onAction, raw, spec.limit]);

  if (!option) return null;

  return (
    <div className={styles.chartContainer}>
      {spec.title && (
        <div className={styles.chartTitle}>{spec.title}</div>
      )}
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height: 240 }}
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

function formatCellValue(val: unknown, format: ColumnFormat, fmt: ReturnType<typeof useLocalization>["fmt"], tr: ReturnType<typeof useLocalization>["tr"]): string {
  if (val === null || val === undefined) return tr("chat.tableNullValue");
  if (typeof val === "string") {
    if (format === "address") return fmt.text.address(val);
    if (format === "text") return val;
    const num = Number(val);
    if (!Number.isNaN(num) && val.trim() !== "") {
      return formatCellValue(num, format, fmt, tr);
    }
    if (format === "datetime" || format === "date" || format === "time" || format === "relative") {
      const ms = new Date(val).getTime();
      if (!Number.isNaN(ms)) return formatCellValue(ms, format, fmt, tr);
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
  const { fmt, tr } = useLocalization();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const raw = data[spec.dataRef];
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const rows = applyTableFilters(raw, spec);
  if (rows.length === 0) return null;

  const totalPages = Math.ceil(rows.length / TABLE_PAGE_SIZE);
  const safePage = Math.min(currentPage, Math.max(totalPages, 1));
  const pageStart = (safePage - 1) * TABLE_PAGE_SIZE;
  const pageEnd = pageStart + TABLE_PAGE_SIZE;
  const pageRows = rows.slice(pageStart, pageEnd);

  const cols = parseColumns(spec.columns);

  function resolveAllRowVars(row: Record<string, unknown>): Record<string, string> {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        for (const [nk, nv] of Object.entries(value as Record<string, unknown>)) {
          vars[`${key}.${nk}`] = nv != null ? String(nv) : "";
        }
      }
      vars[key] = value != null ? String(value) : "";
    }
    return vars;
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            {cols.map((col) => (
              <th key={col.field} className={styles.tableTh}>{col.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const rowActions = Array.isArray(spec.rowActions) ? spec.rowActions[0] : spec.rowActions;
            const rowVars = rowActions ? resolveAllRowVars(row) : undefined;
            const rowQuery = rowVars && rowActions
              ? interpolate(rowActions.query, rowVars)
              : null;
            const rowTooltip = rowQuery ? tr("chat.clickToAsk", { query: rowQuery }) : undefined;
            const globalIdx = pageStart + i;

            return (
              <tr
                key={globalIdx}
                title={rowTooltip}
                data-clickable={!!(rowQuery && onAction)}
                onClick={rowQuery && onAction ? () => onAction(rowQuery!) : undefined}
                onMouseEnter={() => setHoveredIdx(globalIdx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={styles.tableRow}
                style={{ background: hoveredIdx === globalIdx && rowQuery ? "var(--yoca-surface-hover)" : undefined }}
              >
                {cols.map((col) => (
                  <td key={col.field} className={styles.tableTd}>
                    {formatCellValue(getNestedValue(row, col.field), col.format, fmt, tr)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className={styles.pagination}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={safePage <= 1}
            aria-label={tr("table.previousPage")}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            &lt;
          </button>
          <span className={styles.pageInfo}>
            {tr("table.pageRangeText", { count: safePage, total: totalPages })}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={safePage >= totalPages}
            aria-label={tr("table.nextPage")}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );
}

export { ChartRenderer, TableRenderer };
