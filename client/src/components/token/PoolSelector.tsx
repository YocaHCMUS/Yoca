import { useLocalization } from "@/contexts/LocalizationContext";
import { formatLargeNumber } from "@/services/coingecko";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import classNames from "classnames";
import { useEffect, useRef, useState } from "react";
import styles from "./PoolSelector.module.scss";

type TopPoolData = {
  poolAddress: string;
  poolName: string;
  dexId: string | null;
  volumeUsd24h: string | null;
  liquidityUsd: string | null;
};

interface PoolSelectorProps {
  pools: TopPoolData[];
  selectedPool: TopPoolData;
  onPoolChange: (item: { selectedItem: TopPoolData | null }) => void;
}

export function PoolSelector({
  pools,
  selectedPool,
  onPoolChange,
}: PoolSelectorProps) {
  const {} = useLocalization();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!pools || pools.length == 0) return null;

  const handleSelect = (pool: TopPoolData) => {
    onPoolChange({ selectedItem: pool });
    setIsOpen(false);
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={classNames(styles.selector, { [styles.active]: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.selectedContent}>
          <span className={styles.selectedName}>
            {selectedPool.poolName || "Select Pool"}
          </span>
          {selectedPool.dexId && formatDexId(selectedPool.dexId) && (
            <span className={styles.sourceTag}>
              {formatDexId(selectedPool.dexId)}
            </span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.headerRow}>
            <span className={styles.colPair}>PAIR</span>
            <span className={styles.colVol}>24H VOL</span>
            <span className={styles.colLiq}>LIQUIDITY</span>
          </div>

          <div className={styles.list}>
            {pools.map((pool) => (
              <div
                key={pool.poolAddress}
                className={classNames(styles.listItem, {
                  [styles.selected]:
                    selectedPool?.poolAddress == pool.poolAddress,
                })}
                onClick={() => handleSelect(pool)}
              >
                <div className={styles.colPair}>
                  <div className={styles.pairInfo}>
                    <div className={styles.pairName}>{pool.poolName}</div>
                    <div className={styles.pairSource}>
                      {pool.dexId || null}
                    </div>
                  </div>
                </div>
                <div className={styles.colVol}>
                  {formatLargeNumber(Number(pool.volumeUsd24h) || 0)}
                </div>
                <div className={styles.colLiq}>
                  {formatLargeNumber(Number(pool.liquidityUsd) || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
