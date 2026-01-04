import React from 'react';
import { Grid, Column } from '@carbon/react';
import { AssetInfo } from './AssetInfo';
import { PriceHistoryChart } from '../charts/PriceHistoryChart';
import { TokenPerformanceTable } from './TokenPerformanceTable';
import styles from './FundamentalTab.module.scss';

export const FundamentalTab: React.FC = () => {
  return (
    <div className={styles.fundamentalTab}>
      <Grid narrow>
        <Column lg={4} md={4} sm={4}>
          <AssetInfo />
        </Column>
        <Column lg={12} md={4} sm={4}>
          <div className={styles.chartSection}>
            <PriceHistoryChart height={400} />
          </div>
        </Column>
      </Grid>
      <div className={styles.tableSection}>
        <TokenPerformanceTable />
      </div>
    </div>
  );
};