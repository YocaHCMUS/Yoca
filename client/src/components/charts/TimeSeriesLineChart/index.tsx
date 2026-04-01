import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export interface TimeSeriesDataPoint {
  unixTimeMs: number;
  value: number;
}

export default interface SimpleLineChartProps {
  data: TimeSeriesDataPoint[];
  title: string;
  height: number;
  unit: string;
  decimals: number;
  showArea: boolean;
  showZoom: boolean;

  valueFormatter?: (value: number) => string;
  timeFormatter?: (time: number) => string;

  className?: string;
}

export function TimeSeriesLineChart({
  data,
  title,
  className,
}: SimpleLineChartProps) {
  const { sortedData, latestTime, startTime, options } = useMemo(() => {
    const sortedData = data
      .sort((a, b) => a.unixTimeMs - b.unixTimeMs)
      .map((point) => [point.unixTimeMs, point.value]);
    const latestTime =
      sortedData.length > 0 ? sortedData[sortedData.length - 1][0] : 0;
    const startTime = latestTime - SIX_HOURS_MS;

    const options: EChartsOption = {
      title: {
        text: title,
        left: "center",
      },
      grid: {
        top: 8,
        right: 8,
        bottom: 48,
        left: 36,
      },
      xAxis: {
        type: "time",
      },
      yAxis: {
        type: "value",
        min: (value) => value.min - (value.max - value.min) * 0.2,
        max: (value) => value.max + (value.max - value.min) * 0.2,
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          startValue: startTime,
          endValue: latestTime,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 20,
          bottom: 16,
        },
      ],
      series: [
        {
          type: "line",
          data: sortedData,
          lineStyle: {
            width: 2,
          },
        },
      ],
      tooltip: {
        trigger: "axis",
      },
    };

    return { sortedData, latestTime, startTime, options };
  }, [data, title]);

  if (data.length === 0) {
    return <p>No data available</p>;
  }

  return (
    <div className={className || ""}>
      <ReactECharts option={options} />
    </div>
  );
}
