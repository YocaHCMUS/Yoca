import React, { useEffect, useState } from 'react';
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import styles from './TickerBar.module.scss';

interface TickerItem {
  rank: number;
  pair: string;
  price: number;
  change24h: number;
}

export const TickerBar: React.FC = () => {
  const [items, setItems] = useState<TickerItem[]>(
    [
      { rank: 1, pair: 'WSOL-USDC', price: 189.45, change24h: 2.34 },
      { rank: 2, pair: 'JTO-USDC', price: 3.21, change24h: -1.23 },
      { rank: 3, pair: 'BONK-USDC', price: 0.000034, change24h: 5.67 },
      { rank: 4, pair: 'JUP-USDC', price: 0.89, change24h: 1.89 },
      { rank: 5, pair: 'WIF-USDC', price: 2.45, change24h: -0.78 },
    ]
  );

  const duplicatedItems = [...items, ...items];

  return (
    <div className={styles.tickerBar}>
      <div className={styles.tickerTrack}>
        {duplicatedItems.map((item, index) => (
          <div key={`${item.rank}-${index}`} className={styles.tickerItem}>
            <span className={styles.rank}>#{item.rank}</span>
            <span className={styles.pair}>{item.pair}</span>
            <span className={styles.price}>${item.price.toFixed(item.price < 1 ? 6 : 2)}</span>
            <span className={item.change24h >= 0 ? styles.changePositive : styles.changeNegative}>
              {item.change24h >= 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
              {Math.abs(item.change24h).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};