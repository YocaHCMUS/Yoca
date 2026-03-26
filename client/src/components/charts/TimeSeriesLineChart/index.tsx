import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { useMemo } from "react";

export interface TimeSeriesDataPoint {
  unixTimeMs: number;
  value: number;
}

export default interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[] | undefined;
  loading?: boolean;
  isDataSorted?: boolean;
  title?: string;
  height?: number;

  valueFormatter?: (value: number | null) => string;
  timeFormatter?: (time: number | null) => string;

  className?: string;
}

export function TimeSeriesLineChart({
  data,
  loading = false,
  isDataSorted = false,
  title,
  height = 300,
  className,
}: TimeSeriesChartProps) {
  if (loading) {
    return <p>Loading...</p>;
  }

  if (!data || data.length == 0) {
    return <p>No data available</p>;
  }

  const { options } = useMemo(() => {
    const sortedData = (
      !isDataSorted ? data.sort((a, b) => a.unixTimeMs - b.unixTimeMs) : data
    ).map((point) => [point.unixTimeMs, point.value]);

    const latestTime =
      sortedData.length > 0 ? sortedData[sortedData.length - 1][0] : 0;

    const startTime = sortedData.length > 0 ? sortedData[0][0] : 0;

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

  return (
    <div className={className || ""}>
      <ReactECharts option={options} style={{ height }} />
    </div>
  );
}
