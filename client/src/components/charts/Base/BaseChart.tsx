import type { ReactNode } from "react";
import type { ChartLoadingState } from "@/types/chart.types";
import { ChartWrapper } from "@/components/charts/shared";
import styles from "@/components/charts/shared/ChartStyle.module.scss"

interface BaseChartProps {
  title: string;
  // height: number;
  loadingState: ChartLoadingState;
  isEmpty: boolean;
  onRetry: () => void;
  children: ReactNode;
  /** Header controls (e.g. Load data, range toggles) — always visible, unlike body `children` when empty. */
  actions?: ReactNode;
  /** When true, body still renders while empty (manual load: controls inside `children`). */
  preserveChildrenWhenEmpty?: boolean;
}

export function BaseChart(props: BaseChartProps) {
  return (
    <ChartWrapper
        title={props.title}
        // height={props.height}
        loadingState={props.loadingState}
        onRetry={props.onRetry}
        isEmpty={props.isEmpty}
        actions={props.actions}
        preserveChildrenWhenEmpty={props.preserveChildrenWhenEmpty}
        className={styles.Chart}
    >
        {props.children}
    </ChartWrapper>
  );
}
