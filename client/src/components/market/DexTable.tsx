import { useState, useMemo, useEffect, useRef } from "react";
import classNames from "classnames";
import { useNavigate } from "react-router";
import styles from "./DexTable.module.scss";
import { TknImg } from "@/components/TknImg";
import { useLocalization } from "@/contexts/LocalizationContext";
import { ArrowUp, ArrowDown, SettingsAdjust, ChevronDown, Checkmark, Close, Trophy } from "@carbon/icons-react";

export interface DexTableItem {
  id: string;
  poolAddress: string;
  baseAddress: string;
  baseSymbol: string;
  baseName?: string;
  quoteSymbol: string;
  poolName: string;
  dexName: string;
  baseImageUrl: string | null;
  quoteImageUrl?: string | null;
  marketCapUsd: number | null;
  fdvUsd: number | null;
  priceUsd: number | null;
  txns24h: number | null;
  volume24h: number | null;
  priceChange5m: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  poolCreatedAt: string | null;
}

interface DexTableProps {
  data?: DexTableItem[];
  loading?: boolean;
  sortKey?: SortKey | "none";
  sortDirection?: "asc" | "desc";
  filters?: TableFilters;
}

export type SortKey = "marketCap" | "price" | "age" | "txns" | "volume" | "5m" | "1h" | "6h" | "24h" | "liquidity";

export interface RangeFilter {
  min?: string;
  max?: string;
}

export interface TableFilters {
  liquidity: RangeFilter;
  mcap: RangeFilter;
  volume: RangeFilter;
  txns: RangeFilter;
  age: RangeFilter;
  change24h: RangeFilter;
}

export const INITIAL_FILTERS: TableFilters = {
  liquidity: {},
  mcap: {},
  volume: {},
  txns: {},
  age: {},
  change24h: {},
};

function formatAge(dateStr: string | null): string {
  if (!dateStr) return "-";
  const ms = Date.now() - new Date(dateStr).getTime();
  if (ms < 0) return "-";
  
  const days = Math.floor(ms / 86400000);
  if (days > 0) return `${days}d`;
  
  const hours = Math.floor(ms / 3600000);
  if (hours > 0) return `${hours}h`;
  
  const mins = Math.floor(ms / 60000);
  if (mins > 0) return `${mins}m`;
  
  return "just now";
}

function getSortValue(item: DexTableItem, key: SortKey): number {
  switch (key) {
    case "marketCap":
      return item.marketCapUsd || item.fdvUsd || 0;
    case "price":
      return item.priceUsd || 0;
    case "age":
      return item.poolCreatedAt ? new Date(item.poolCreatedAt).getTime() : 0;
    case "txns":
      return item.txns24h || 0;
    case "volume":
      return item.volume24h || 0;
    case "5m":
      return item.priceChange5m || -999999;
    case "1h":
      return item.priceChange1h || -999999;
    case "6h":
      return item.priceChange6h || -999999;
    case "24h":
      return item.priceChange24h || -999999;
    case "liquidity":
      return item.liquidityUsd || 0;
    default:
      return 0;
  }
}

export function DexTable({ 
  data = [], 
  loading = false, 
  sortKey = "none", 
  sortDirection = "desc",
  filters = INITIAL_FILTERS
}: DexTableProps) {
  const { fmt } = useLocalization();
  const navigate = useNavigate();

  const sortedData = useMemo(() => {
    if (!data.length) return [];
    
    let filtered = [...data];

    // Apply Filters
    filtered = filtered.filter(item => {
      const checkRange = (val: number | null, range: RangeFilter) => {
        if (val === null) return true;
        const min = range.min ? parseFloat(range.min) : -Infinity;
        const max = range.max ? parseFloat(range.max) : Infinity;
        return val >= min && val <= max;
      };

      const ageHours = item.poolCreatedAt ? (Date.now() - new Date(item.poolCreatedAt).getTime()) / 3600000 : null;

      return (
        checkRange(item.liquidityUsd, filters.liquidity) &&
        checkRange(item.marketCapUsd || item.fdvUsd, filters.mcap) &&
        checkRange(item.volume24h, filters.volume) &&
        checkRange(item.txns24h, filters.txns) &&
        checkRange(ageHours, filters.age) &&
        checkRange(item.priceChange24h, filters.change24h)
      );
    });

    // Apply Sorting
    if (sortKey === "none") return filtered;

    return filtered.sort((a, b) => {
      const valA = getSortValue(a, sortKey as SortKey);
      const valB = getSortValue(b, sortKey as SortKey);
      
      if (valA === valB) return 0;
      
      const comparison = valA > valB ? 1 : -1;
      return sortDirection === "desc" ? -comparison : comparison;
    });
  }, [data, sortKey, sortDirection, filters]);

  const formatCompactPercentText = (val: number) => {
    const absVal = Math.abs(val);
    if (absVal < 100) {
      return `${Number(absVal.toFixed(2))}%`;
    } else if (absVal < 100000) {
      const truncated = Math.trunc(absVal);
      return `${Intl.NumberFormat('en-US').format(truncated)}%`;
    } else {
      const compact = Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(absVal);
      return `${compact}%`;
    }
  };

  const renderTrend = (val: number | null) => {
    if (val == null) return "-";
    const clz = val > 0 ? styles.positive : val < 0 ? styles.negative : styles.neutral;
    const sign = val > 0 ? "+" : val < 0 ? "-" : "";
    return (
      <span className={clz}>
        {sign}{formatCompactPercentText(val)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className={styles.dexTableContainer}>
        <div className={styles.emptyState}>Loading market data...</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={styles.dexTableContainer}>
        <div className={styles.emptyState}>No pools found.</div>
      </div>
    );
  }

  return (
    <div className={styles.dexTableContainer}>
      <table className={styles.dexTable}>
        <thead>
          <tr>
            <th className={styles.alignLeft}>TOKEN</th>
            <th>MCAP</th>
            <th>PRICE</th>
            <th>AGE</th>
            <th>TXNS</th>
            <th>VOLUME</th>
            <th>5M</th>
            <th>1H</th>
            <th>6H</th>
            <th>24H</th>
            <th>LIQUIDITY</th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((pool, idx) => {
            const mcap = pool.marketCapUsd || pool.fdvUsd;
            
            const baseSymbol = pool.baseSymbol?.toUpperCase() || "UNK";
            const quoteSymbol = pool.quoteSymbol?.toUpperCase() || "UNK";
            const baseDescription = (pool.baseName && pool.baseName.toUpperCase() !== baseSymbol)
              ? pool.baseName 
              : null;
            
            return (
              <tr 
                key={pool.poolAddress} 
                onClick={() => navigate(`/tokens/${pool.baseAddress}/${pool.poolAddress}`)}
                style={{ cursor: "pointer" }}
              >
                <td className={styles.alignLeft}>
                  <div className={styles.tokenCell}>
                    <span className={styles.rank}>#{idx + 1}</span>
                    <div className={styles.doubleImage}>
                      <div className={styles.baseImgWrapper}>
                        <TknImg src={pool.baseImageUrl} alt={baseDescription || baseSymbol} size={28} />
                      </div>
                      <div className={styles.quoteImgWrapper}>
                        <TknImg src={pool.quoteImageUrl || null} alt={pool.quoteSymbol} size={14} />
                      </div>
                    </div>
                    <div className={styles.pairNamesText}>
                      <span className={styles.baseSy}>{baseSymbol}</span>
                      <span className={styles.quoteSy}>/{quoteSymbol}</span>
                      {baseDescription && (
                        <span className={styles.poolDescription} title={baseDescription}>
                          {baseDescription}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                  <span className={styles.numberValue}>
                    {mcap ? fmt.num.compact.currency(mcap) : "-"}
                  </span>
                </td>
                <td>
                  <span className={classNames(styles.numberValue, styles.positive)}>
                    {pool.priceUsd ? fmt.num.currency(pool.priceUsd) : "-"}
                  </span>
                </td>
                <td>
                  <span className={styles.secondaryValue}>{formatAge(pool.poolCreatedAt)}</span>
                </td>
                <td>
                  <span className={styles.numberValue}>
                    {pool.txns24h ? fmt.num.compact.decimal(pool.txns24h) : "-"}
                  </span>
                </td>
                <td>
                  <span className={styles.numberValue}>
                    {pool.volume24h ? `$${fmt.num.compact.decimal(pool.volume24h)}` : "-"}
                  </span>
                </td>
                <td className={styles.numberValue}>{renderTrend(pool.priceChange5m)}</td>
                <td className={styles.numberValue}>{renderTrend(pool.priceChange1h)}</td>
                <td className={styles.numberValue}>{renderTrend(pool.priceChange6h)}</td>
                <td className={styles.numberValue}>{renderTrend(pool.priceChange24h)}</td>
                <td>
                  <span className={styles.numberValue}>
                    {pool.liquidityUsd ? `$${fmt.num.compact.decimal(pool.liquidityUsd)}` : "-"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
