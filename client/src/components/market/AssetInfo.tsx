import React from 'react';
import { Tile, SkeletonText } from '@carbon/react';
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import styles from './AssetInfo.module.scss';

export interface AssetData {
  name: string;
  symbol: string;
  imageUrl: string | null;
  price: number;
  priceChange24h: number;
  marketCap: number;
  volume24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  allTimeHigh?: number;
  allTimeHighChangePercentage?: number;
  allTimeLow?: number;
  allTimeLowChangePercentage?: number;
}

interface AssetInfoProps {
  /** Token/Asset data to display */
  data?: AssetData | null;
  /** Loading state */
  loading?: boolean;
}

/**
 * Format large numbers with appropriate suffixes
 */
const formatNumber = (num: number, prefix = '$') => {
  if (num >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${prefix}${(num / 1e3).toFixed(2)}K`;
  return `${prefix}${num.toFixed(2)}`;
};

const formatSupply = (num: number, symbol: string) => {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T ${symbol}`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B ${symbol}`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M ${symbol}`;
  return `${num.toLocaleString()} ${symbol}`;
};

const formatPercentage = (num: number) => {
  if (Math.abs(num) >= 1000) {
    return `${num >= 0 ? '+' : ''}${(num / 1000).toFixed(1)}K%`;
  }
  return `${num >= 0 ? '+' : ''}${num.toFixed(2)}%`;
};

export const AssetInfo: React.FC<AssetInfoProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <Tile className={styles.assetInfo}>
        <div className={styles.header}>
          <div className={styles.logoPlaceholder} />
          <div className={styles.title}>
            <SkeletonText heading width="120px" />
            <SkeletonText width="60px" />
          </div>
        </div>
        <div className={styles.price}>
          <SkeletonText heading width="150px" />
          <SkeletonText width="80px" />
        </div>
        <div className={styles.stats}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.statItem}>
              <SkeletonText width="100px" />
              <SkeletonText width="80px" />
            </div>
          ))}
        </div>
      </Tile>
    );
  }

  if (!data) {
    return (
      <Tile className={styles.assetInfo}>
        <div className={styles.emptyState}>
          <p>Select a token from the table below to view details</p>
        </div>
      </Tile>
    );
  }

  const stats = [
    { 
      label: 'Market Cap', 
      value: formatNumber(data.marketCap), 
      change: formatPercentage(data.priceChange24h)
    },
    { 
      label: 'Volume 24h', 
      value: formatNumber(data.volume24h), 
      change: null 
    },
    { 
      label: 'Circulating Supply', 
      value: formatSupply(data.circulatingSupply, data.symbol), 
      change: null 
    },
    { 
      label: 'Total Supply', 
      value: data.totalSupply && data.totalSupply > 0 
        ? formatSupply(data.totalSupply, data.symbol) 
        : 'N/A', 
      change: null 
    },
    { 
      label: 'All-Time High', 
      value: data.allTimeHigh && data.allTimeHigh > 0 
        ? formatNumber(data.allTimeHigh) 
        : 'N/A', 
      change: data.allTimeHighChangePercentage != null 
        ? formatPercentage(data.allTimeHighChangePercentage)
        : null
    },
    { 
      label: 'All-Time Low', 
      value: data.allTimeLow && data.allTimeLow > 0 
        ? formatNumber(data.allTimeLow) 
        : 'N/A', 
      change: data.allTimeLowChangePercentage != null 
        ? formatPercentage(data.allTimeLowChangePercentage)
        : null
    },
  ];

  const isPositive = data.priceChange24h >= 0;

  return (
    <Tile className={styles.assetInfo}>
      <div className={styles.header}>
        {data.imageUrl ? (
          <img
            src={data.imageUrl}
            alt={data.name}
            className={styles.logo}
          />
        ) : (
          <div className={styles.logoPlaceholder}>
            {data.symbol.charAt(0)}
          </div>
        )}
        <div className={styles.title}>
          <h2>{data.name}</h2>
          <span className={styles.symbol}>{data.symbol}</span>
        </div>
      </div>
      <div className={styles.price}>
        <span className={styles.priceValue}>
          ${data.price < 1 ? data.price.toFixed(6) : data.price.toFixed(2)}
        </span>
        <span className={`${styles.priceChange} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          {formatPercentage(data.priceChange24h)}
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
