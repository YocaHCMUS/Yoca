import React from 'react';
import { MarketHeatmap } from '../charts/MarketHeatmap';
import { TransactionTable } from './TransactionTable';
import styles from './OverviewTab.module.scss';

export const OverviewTab: React.FC = () => {
  return (
    <div className={styles.overviewTab}>
      <div className={styles.heatmapSection}>
        <MarketHeatmap height={500} />
      </div>
      <div className={styles.tableSection}>
        <TransactionTable />
      </div>
    </div>
  );
};