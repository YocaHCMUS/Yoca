import type { ECharts } from "echarts";

interface EChartsEventParams {
  componentType: string;
  dataIndex?: number;
  seriesIndex?: number;
}

interface ZRClickEvent {
  offsetX: number;
  offsetY: number;
  target?: unknown;
}

export function snapToNearest(value: number, sorted: number[]): number {
  if (sorted.length === 0) return value;

  let lo = 0;
  let hi = sorted.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (sorted[mid] < value) lo = mid + 1;
    else hi = mid;
  }

  if (lo === 0) return sorted[0];
  if (lo >= sorted.length - 1) return sorted[sorted.length - 1];

  const prev = sorted[lo - 1];
  const next = sorted[lo];
  return value - prev <= next - value ? prev : next;
}

export function attachChartDayClick(
  chart: ECharts,
  timestamps: number[],
  onDayClick: (timestamp: number) => void,
  axisType: "category" | "time" = "category",
): () => void {
  const seriesHandler = (params: EChartsEventParams) => {
    if (params.componentType !== "series" || params.dataIndex == null) return;
    const ts = timestamps[params.dataIndex];
    if (ts != null) onDayClick(ts);
  };

  // const zr = chart.getZr();
  // const blankHandler = (event: ZRClickEvent) => {
  //   if (event.target) return;

  //   const result = chart.convertFromPixel(
  //     { xAxisIndex: 0 },
  //     [event.offsetX, event.offsetY],
  //   );

  //   console.log("[chart-click] Blank click at pixel:", event.offsetX, event.offsetY, "converted to:", result);
  //   if (!result) return;

  //   const xValue = (Array.isArray(result) ? result[0] : result) as
  //     | number
  //     | string
  //     | undefined;
  //   if (xValue == null) return;

  //   let ts: number | undefined;
  //   if (typeof xValue === "number" && axisType === "category") {
  //     ts = timestamps[xValue];
  //   } else if (typeof xValue === "number") {
  //     ts = snapToNearest(xValue, timestamps);
  //   }

  //   console.log("[chart-click] Interpreted xValue:", xValue, "mapped to timestamp:", ts);

  //   if (ts != null) onDayClick(ts);
  // };

  chart.on("click", seriesHandler);
  // zr.on("click", blankHandler);

  return () => {
    chart.off("click", seriesHandler);
    // zr.off("click", blankHandler);
  };
}
