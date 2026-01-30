import { TimeSeriesLineChart } from "../charts/TimeSeriesLineChart";

interface ChartPoint {
    unixTimeMs: number;
    value: number;
}

interface PriceChartProps {
    data: ChartPoint[];
}

export const PriceChart = ({ data }: PriceChartProps) => {
    return (
        <TimeSeriesLineChart
            data={data}
            title="24h Price Chart"
            height={300}
            unit="USD"
            decimals={2}
            showArea={true}
            showZoom={true}
        />
    );
};
