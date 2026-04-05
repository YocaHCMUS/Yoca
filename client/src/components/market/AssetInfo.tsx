import React from 'react';
import { Tile, SkeletonText } from '@carbon/react';
import { ArrowUp, ArrowDown } from '@carbon/icons-react';
import { useLocalization } from '@/contexts/LocalizationContext';
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
// Removed local formatNumber, formatSupply, and formatPercentage in favor of fmt

export const AssetInfo: React.FC<AssetInfoProps> = ({ data, loading }) => {
  const { tr, fmt } = useLocalization();
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
          <p>{tr("marketPage.selectToken")}</p>
        </div>
      </Tile>
    );
  }

  const stats = [
    { 
      label: tr("marketPage.marketCap"), 
      value: fmt.num.compact.currency(data.marketCap), 
      change: fmt.num.percent(data.priceChange24h)
    },
    { 
      label: tr("marketPage.volume24h"), 
      value: fmt.num.compact.currency(data.volume24h), 
      change: null 
    },
    { 
      label: tr("token.marketStats.circSupply"), 
      value: fmt.num.compact.decimal(data.circulatingSupply) + " " + data.symbol, 
      change: null 
    },
    { 
      label: tr("token.marketStats.totalSupply"), 
      value: data.totalSupply && data.totalSupply > 0 
        ? fmt.num.compact.decimal(data.totalSupply) + " " + data.symbol 
        : tr("marketPage.na"), 
      change: null 
    },
    { 
      label: tr("marketPage.allTimeHigh"), 
      value: data.allTimeHigh && data.allTimeHigh > 0 
        ? fmt.num.currency(data.allTimeHigh) 
        : tr("marketPage.na"), 
      change: data.allTimeHighChangePercentage != null 
        ? fmt.num.percent(data.allTimeHighChangePercentage)
        : null
    },
    { 
      label: tr("marketPage.allTimeLow"), 
      value: data.allTimeLow && data.allTimeLow > 0 
        ? fmt.num.currency(data.allTimeLow) 
        : tr("marketPage.na"), 
      change: data.allTimeLowChangePercentage != null 
        ? fmt.num.percent(data.allTimeLowChangePercentage)
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
          {fmt.num.currency(data.price)}
        </span>
        <span className={`${styles.priceChange} ${isPositive ? styles.positive : styles.negative}`}>
          {isPositive ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          {fmt.num.percent(data.priceChange24h)}
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
