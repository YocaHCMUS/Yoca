import React from "react";
import { MarketHeatmap } from "../charts/MarketHeatmap";
import styles from "./OverviewTab.module.scss";
import { TransactionTable } from "./TransactionTable";

export const OverviewTab: React.FC = () => {
  return (
    <div className={styles.overviewTab}>
      <div className={styles.heatmapSection}>
        <MarketHeatmap />
      </div>
      <div className={styles.tableSection}>
        <TransactionTable />
      </div>
    </div>
  );
};
