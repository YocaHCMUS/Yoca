import type { ChartDataSeries } from "@/types/chart-data.types";

interface StandardChartExports<TData> {
    getChartInstance: () => echarts.ECharts | null;
    toCSV: (data: TData) => ChartDataSeries[];
}