import React from 'react';
import { Tile } from '@carbon/react';
import styles from './PriceHistoryChart.module.scss';

interface PriceHistoryChartProps {
  height?: number;
}

export const PriceHistoryChart: React.FC<PriceHistoryChartProps> = ({ height = 400 }) => {
  return (
    <Tile className={styles.chart}>
      <div style={{ height: `${height}px` }} className={styles.placeholder}>
        <p>Price History Chart Placeholder</p>
        <p>Line chart will be implemented here</p>
      </div>
    </Tile>
  );
};