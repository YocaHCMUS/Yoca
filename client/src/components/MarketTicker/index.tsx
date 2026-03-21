import React from 'react';
import { Link } from 'react-router';
import styles from './MarketTicker.module.scss';
import clsx from 'clsx';

export interface MarketTickerItem {
  address: string;
  rank: number;
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
}

interface MarketTickerProps {
  label?: string;
  icon?: React.ReactNode;
  items: MarketTickerItem[];
  formatter: {
    currency: (v: number) => string;
    percent: (v: number) => string;
  };
}

const MarketTicker: React.FC<MarketTickerProps> = ({ label, icon, items, formatter }) => {
  if (!items || items.length === 0) return null;

  // Duplicate items for infinite scroll effect
  const displayItems = [...items, ...items, ...items, ...items];

  return (
    <div className={styles.tickerContainer}>
      {label && (
        <div className={styles.label}>
          {icon}
          {label}
        </div>
      )}
      <div className={styles.tickerWrapper}>
        <div className={styles.tickerContent}>
          {displayItems.map((item, idx) => (
            <Link 
              key={`${item.address}-${idx}`} 
              to={`/tokens/${item.address}`} 
              className={styles.tickerItem}
            >
              <span className={styles.rank}>#{item.rank}</span>
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.symbol} className={styles.avatar} />
              )}
              <span className={styles.symbol}>{item.symbol.toUpperCase()}</span>
              <span className={styles.price}>{formatter.currency(item.priceUsd)}</span>
              <span className={clsx(styles.change, {
                [styles.positive]: item.priceChange24h >= 0,
                [styles.negative]: item.priceChange24h < 0,
              })}>
                {formatter.percent(item.priceChange24h)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MarketTicker;
