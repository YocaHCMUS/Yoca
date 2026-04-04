import type { ChartLoadingState } from "@/types/chart.types";
import { ChartWrapper } from "@/components/charts/shared";
import styles from "@/components/charts/shared/ChartStyle.module.scss"

interface BaseChartProps {
  title: string;
  // height: number;
  loadingState: ChartLoadingState;
  isEmpty: boolean;
  onRetry: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export function BaseChart(props: BaseChartProps) {
  return (
    <ChartWrapper
      title={props.title}
      // height={props.height}
      loadingState={props.loadingState}
      onRetry={props.onRetry}
      isEmpty={props.isEmpty}
      className={styles.Chart}
      actions={props.actions}
    >
      {props.children}
    </ChartWrapper>
  );
}
