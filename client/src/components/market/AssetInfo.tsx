import React from 'react';
import { Tile } from '@carbon/react';
import { ArrowUp } from '@carbon/icons-react';
import styles from './AssetInfo.module.scss';

export const AssetInfo: React.FC = () => {
  const stats = [
    { label: 'Market Cap', value: '$89.4B', change: '+2.34%' },
    { label: 'Volume 24h', value: '$2.1B', change: '+5.67%' },
    { label: 'Circulating Supply', value: '472M SOL', change: null },
    { label: 'Total Supply', value: '580M SOL', change: null },
    { label: 'All-Time High', value: '$260.06', change: '-27.2%' },
    { label: 'All-Time Low', value: '$0.50', change: '+37,790%' },
  ];

  return (
    <Tile className={styles.assetInfo}>
      <div className={styles.header}>
        <img
          src="https://cryptologos.cc/logos/solana-sol-logo.png"
          alt="Solana"
          className={styles.logo}
        />
        <div className={styles.title}>
          <h2>Solana</h2>
          <span className={styles.symbol}>SOL</span>
        </div>
      </div>
      <div className={styles.price}>
        <span className={styles.priceValue}>$189.45</span>
        <span className={styles.priceChange}>
          <ArrowUp size={16} />
          +2.34%
        </span>
      </div>
      <div className={styles.stats}>
        {stats.map(stat => (
          <div key={stat.label} className={styles.statItem}>
            <span className={styles.statLabel}>{stat.label}</span>
            <div className={styles.statValue}>
              <span>{stat.value}</span>
              {stat.change && (
                <span className={stat.change.startsWith('+') ? styles.positive : styles.negative}>
                  {stat.change}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Tile>
  );
};