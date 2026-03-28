import { useLocalization } from "@/contexts/LocalizationContext";
import { useCarbonTokens } from "@/hooks/useCarbonToken";
import { cds } from "@/util/carbon-theme";
import { InlineLoading, Stack } from "@carbon/react";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

// Add your specific usecase here and help yourself
export type TimeSeriesChartHelper = "average-buy-sell";

export interface TimeSeriesDataPoint {
  unixTimeMs: number;
  value: number;
}

export interface MarkLineConfig {
  value: number;
  label: string;
  color?: string;
}

export interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[] | undefined;
  markLines?: MarkLineConfig[];
  loading?: boolean;
  isDataSorted?: boolean;
  title?: string;
  height?: number | string;
  className?: string;
  helper?: TimeSeriesChartHelper;
  valueFormatter?: (val: number | null) => string;
}

export function TimeSeriesLineChart({
  data,
  markLines = [],
  loading = false,
  isDataSorted = false,
  title,
  helper,
  height = 300,
  className,
  valueFormatter,
}: TimeSeriesChartProps) {
  const { fmt, tr } = useLocalization();

  console.log(markLines);

  const tokens = useCarbonTokens({
    textPrimary: cds.textPrimary,
    textSecondary: cds.textSecondary,
    textHelper: cds.textHelper,
    bgInverse: cds.backgroundInverse,
    textInverse: cds.textInverse,
    success: cds.supportSuccess,
    error: cds.supportError,
    borderSubtle: cds.borderSubtle00,
    // Default color for markLines
    interactive: cds.interactive01,
  });

  const chartData = useMemo(() => {
    if (!data || data.length == 0) return [];
    const sorted = isDataSorted
      ? data
      : [...data].sort((a, b) => a.unixTimeMs - b.unixTimeMs);
    return sorted.map((p) => [p.unixTimeMs, p.value]);
  }, [data, isDataSorted]);

  const isPositive = useMemo(() => {
    if (chartData.length < 2) return true;
    return (
      (chartData[chartData.length - 1][1] as number) >=
      (chartData[0][1] as number)
    );
  }, [chartData]);

  const option = useMemo((): EChartsOption => {
    if (chartData.length == 0) return {};

    const trendColor = isPositive ? tokens.success : tokens.error;
    const startTime = chartData[0][0] as number;
    const endTime = chartData[chartData.length - 1][0] as number;
    const range = endTime - startTime;

    return {
      backgroundColor: "transparent",
      title: {
        text: title,
        left: "center",
        textStyle: { fontSize: 14, fontWeight: 600, color: tokens.textPrimary },
      },
      grid: { left: 10, right: 10, top: 40, bottom: 30, containLabel: true },
      tooltip: {
        trigger: "axis",
        backgroundColor: tokens.bgInverse,
        borderColor: "transparent",
        borderRadius: 4,
        padding: 0,
        textStyle: { color: tokens.textInverse, fontSize: 12 },
        formatter: (params) => {
          if (!Array.isArray(params) || !params[0]) return "";
          const [ts, val] = params[0].data as [number, number];
          const dateStr =
            range < 86_400_000 * 2
              ? fmt.datetime.datetime(ts)
              : fmt.datetime.date(ts);
          const valStr = valueFormatter ? valueFormatter(val) : val;

          return `
            <div style="padding:8px 12px; border-radius:4px; background:${tokens.bgInverse}">
              <div style="color:${tokens.textInverse}; opacity:0.7; margin-bottom:4px; font-size:11px">${dateStr}</div>
              <div style="font-size:14px; font-weight:700; color:${tokens.textInverse}">${valStr}</div>
            </div>`;
        },
      },
      xAxis: {
        type: "time",
        axisLine: { show: false },
        axisTick: { show: false },
        // Suggest a reasonable number of splits for a 300px-ish height chart
        // splitNumber: 8,
        // Prevent ticks from being too close together
        // minInterval: 3600 * 1000 * 24, // 1 day ms
        axisLabel: {
          color: tokens.textSecondary,
          fontSize: 11,
          // Use hideOverlap to automatically remove clashing labels
          hideOverlap: true,
          formatter: (val: number) => {
            // If the total range is > 30 days, just show Month/Day
            if (range > 86_400_000 * 30) {
              return fmt.datetime.date(val);
            }
            // If < 24h, show Time
            if (range < 86_400_000) {
              return fmt.datetime.time(val);
            }
            // Default fallback
            return fmt.datetime.date(val);
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        scale: true,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: tokens.textSecondary,
          fontSize: 11,
          formatter: (val: number) => fmt.num.compact.currency(val),
        },
        splitLine: {
          lineStyle: { color: tokens.borderSubtle, type: "dashed" },
        },
        min: (value) => {
          let min = value.min;
          markLines.forEach((ml) => {
            if (ml.value < min) min = ml.value;
          });
          const spread = value.max - value.min || min * 0.1;
          return min - spread * 0.15; // 15% buffer based on spread
        },
        max: (value) => {
          let max = value.max;
          markLines.forEach((ml) => {
            if (ml.value > max) max = ml.value;
          });
          const spread = value.max - value.min || max * 0.1;
          return max + spread * 0.15;
        },
      },
      series: [
        {
          type: "line",
          data: chartData,
          showSymbol: false,
          smooth: 0.1,
          lineStyle: { width: 2, color: trendColor },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: trendColor },
                { offset: 1, color: "transparent" },
              ],
            },
            opacity: 0.15,
          },
          markLine: {
            // Important: Default is 2. For tokens, we need high precision.
            precision: 8,
            lineStyle: {
              width: 1,
              opacity: 0.8,
            },
            data: markLines.map((ml, index) => ({
              name: ml.label,
              yAxis: ml.value,
              lineStyle: { color: ml.color || tokens.interactive },
              label: {
                formatter: () =>
                  `${ml.label}: ${valueFormatter ? valueFormatter(ml.value) : ml.value}`,
                position:
                  helper == "average-buy-sell" && markLines.length == 2
                    ? ml.value > markLines.at(index - 1)!.value
                      ? "insideEndTop"
                      : "insideEndBottom"
                    : "insideEndBottom",
                backgroundColor: ml.color,
                padding: [4, 4],
              },
            })),
          },
        },
      ],
    };
  }, [chartData, isPositive, title, fmt, valueFormatter, tokens, markLines]);

  if (loading)
    return (
      <Stack style={{ height, alignItems: "center", justifyContent: "center" }}>
        <InlineLoading description={tr("common.loading")} />
      </Stack>
    );

  if (chartData.length == 0)
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
        option={option}
        style={{ height }}
        notMerge
        opts={{ renderer: "canvas" }}
      />
    </div>
  );
}
