import type { ChartLoadingState } from "@/types/chart.types";
import type { ExportFormat } from "@/components/charts/shared";
import { ChartWrapper } from "@/components/charts/shared";

interface BaseChartProps {
  title: string;
  height: number;
  loadingState: ChartLoadingState;
  isEmpty: boolean;
  onRetry: () => void;
  onExport: (format: ExportFormat) => void;
  children: React.ReactNode;
}

export function BaseChart(props: BaseChartProps) {
  return (
    <ChartWrapper
        title={props.title}
        height={props.height}
        loadingState={props.loadingState}
        onRetry={props.onRetry}
        onExport={props.onExport}
        isEmpty={props.isEmpty}
    >
        {props.children}
    </ChartWrapper>
  );
}
