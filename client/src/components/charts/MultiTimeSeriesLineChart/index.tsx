import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { cds } from "@/util/carbon-theme";
import { attachChartDayClick } from "@/util/chart-click";
import { hashColor } from "@/util/color";
import { InlineLoading, Stack } from "@carbon/react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useEffect, useMemo, useRef } from "react";

export type TimeSeriesDataPoint = { unixTimeMs: number; value: number };

export type Series = {
  key: string;
  label?: string;
  data: TimeSeriesDataPoint[];
  color?: string;
  logoUri?: string;
};

export interface MultiTimeSeriesChartProps {
  series: Series[] | undefined;
  loading?: boolean;
  height?: number | string;
  className?: string;
  valueFormatter?: (v: number | null) => string;
  showLegend?: boolean;
  onClickDay?: (timestamp: number) => void;
  stacked?: boolean;
}

export function MultiTimeSeriesLineChart({
  series,
  loading = false,
  height = 300,
  className,
  valueFormatter,
  showLegend = true,
  onClickDay,
  stacked = false,
}: MultiTimeSeriesChartProps) {
  const { fmt, tr } = useLocalization();
  const chartRef = useRef<ReactECharts>(null);
  const tokens = useCarbonTokens({
    textPrimary: cds.textPrimary,
    textSecondary: cds.textSecondary,
    textHelper: cds.textHelper,
    borderSubtle: cds.borderSubtle00,
    bgInverse: cds.backgroundInverse,
    textInverse: cds.textInverse,
    success: cds.supportSuccess,
    error: cds.supportError,
    interactive: cds.interactive,
    layer: cds.layer02,
  });

  const prepared = useMemo(() => {
    if (!series || series.length == 0) return [];
    return series.map((s) => {
      const sorted = [...s.data].sort((a, b) => a.unixTimeMs - b.unixTimeMs);
      return {
        ...s,
        chartData: sorted.map((p) => [p.unixTimeMs, p.value]),
      } as const;
    });
  }, [series]);

  const allPoints = useMemo(
    () => prepared.flatMap((s) => s.chartData),
    [prepared],
  );

  const option = useMemo((): EChartsOption => {
    if (allPoints.length == 0) return {};

    const startTime = allPoints[0][0];
    const endTime = allPoints[allPoints.length - 1][0];
    const range = endTime - startTime;

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: tokens.bgInverse,
        borderColor: "transparent",
        borderRadius: 4,
        padding: 0,
        textStyle: { color: tokens.textInverse, fontSize: 12 },
        formatter: (params) => {
          if (!Array.isArray(params) || params.length == 0) return "";
          const ts = (params[0].data as [number, number])[0];
          const dateStr =
            range < 86_400_000 * 90
              ? fmt.datetime.datetime(ts)
              : fmt.datetime.date(ts);

          const rows = params
            .map((p) => {
              const name = p.seriesName;
              const val = (p.data as [number, number])[1];
              const color = p.color;
              const formatted = valueFormatter ? valueFormatter(val) : val;
              return (
                `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">` +
                `<span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block"></span>` +
                `<div style="color:${tokens.textInverse};font-size:13px"><strong style="display:inline-block;min-width:90px;color:${tokens.textInverse}">${name}</strong> ${formatted}</div>` +
                `</div>`
              );
            })
            .join("");

          return `
            <div style="padding:8px 12px; border-radius:4px; background:${tokens.bgInverse}">
              <div style="color:${tokens.textInverse}; opacity:0.7; margin-bottom:4px; font-size:11px">${dateStr}</div>
              <div style="font-size:13px; color:${tokens.textInverse}">${rows}</div>
            </div>`;
        },
      },
      legend: showLegend
        ? {
            show: true,
            data: prepared.map((s) => s.label ?? s.key),
            textStyle: { color: tokens.textPrimary },
            backgroundColor: tokens.layer,
            padding: 8,
          }
        : undefined,
      grid: { left: 10, right: 10, top: 20, bottom: 30, containLabel: true },
      xAxis: {
        type: "time",
        axisLine: { show: true },
        axisTick: { show: true },
        axisLabel: {
          color: tokens.textPrimary,
          formatter: (val) => {
            if (range > 86_400_000 * 30) return fmt.datetime.date(val);
            if (range < 86_400_000) return fmt.datetime.time(val);
            return fmt.datetime.date(val);
          },
          hideOverlap: true,
        },
        splitLine: {
          show: true,
          lineStyle: { color: tokens.borderSubtle, type: "dashed" },
        },
      },
      yAxis: {
        type: "value",
        position: "right",
        axisLabel: {
          color: tokens.textSecondary,
          formatter: valueFormatter,
        },
        splitLine: {
          lineStyle: { color: tokens.borderSubtle, type: "dashed" },
        },
        min: (v) => v.min - (v.max - v.min) * 0.15,
        max: (v) => v.max + (v.max - v.min) * 0.15,
      },
      series: prepared.map((s) => {
        const color = s.color ?? hashColor(s.key);

        return {
          name: s.label ?? s.key,
          type: "line",
          data: s.chartData,
          showSymbol: true,
          smooth: 0.1,
          lineStyle: { width: 2, color },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: `${color}4D` },
                { offset: 1, color: `${color}0D` },
              ],
            },
          },
          color,
          stack: stacked ? "total" : undefined, 
        } as const;
      }),
    };
  }, [prepared, allPoints, fmt, tokens, valueFormatter, showLegend]);

  const allTimestamps = useMemo(
    () =>
      series
        ? [...new Set(series.flatMap((s) => s.data.map((p) => p.unixTimeMs)))].sort(
            (a, b) => a - b,
          )
        : [],
    [series],
  );

  useEffect(() => {
    if (!onClickDay || !chartRef.current) return;
    if (allTimestamps.length === 0) return;

    const chartInstance = chartRef.current.getEchartsInstance();
    return attachChartDayClick(chartInstance, allTimestamps, onClickDay, "time");
  }, [onClickDay, allTimestamps]);

  if (loading)
    return (
      <Stack style={{ height, alignItems: "center", justifyContent: "center" }}>
        <InlineLoading description={tr("common.loading")} />
      </Stack>
    );

  if (allPoints.length == 0)
    return (
      <div
        style={{
          height,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: tokens.textHelper,
        }}
      >
        {tr("common.noData")}
      </div>
    );

  return (
    <div className={className}>
      <ReactECharts
        ref={chartRef}
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
