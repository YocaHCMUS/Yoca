import React from 'react';
import { Tile } from '@carbon/react';
import styles from './MarketHeatmap.module.scss';

interface MarketHeatmapProps {
  height?: number;
}

export const MarketHeatmap: React.FC<MarketHeatmapProps> = ({ height = 400 }) => {
  return (
    <Tile className={styles.heatmap}>
      <div style={{ height: `${height}px` }} className={styles.placeholder}>
        <p>Market Heatmap Placeholder</p>
        <p>Heatmap visualization will be implemented here</p>
      </div>
    </Tile>
  );
};