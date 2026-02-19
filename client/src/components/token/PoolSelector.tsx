import { client } from "@/api/main";
import { formatLargeNumber } from "@/services/coingecko";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import classNames from "classnames";
import type { InferResponseType } from "hono/client";
import { useEffect, useRef, useState } from "react";
import styles from "./PoolSelector.module.scss";

type TopPoolData = InferResponseType<
  (typeof client.api.tokens)[":address"]["pools"]["$get"],
  200
>[number];

interface PoolSelectorProps {
  pools: TopPoolData[];
  selectedPool: TopPoolData | null;
  onPoolChange: (item: { selectedItem: TopPoolData | null }) => void;
}

export const PoolSelector = ({
  pools,
  selectedPool,
  onPoolChange,
}: PoolSelectorProps) => {
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

  if (!pools || pools.length === 0) return null;

  const handleSelect = (pool: TopPoolData) => {
    onPoolChange({ selectedItem: pool });
    setIsOpen(false);
  };

  const formatDexId = (dexId: string | null): string | null => {
    if (!dexId || dexId.toLowerCase() === "unknown") return null;
    return dexId
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={classNames(styles.selector, { [styles.active]: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className={styles.selectedContent}>
          <span className={styles.selectedName}>
            {selectedPool?.data.poolName || "Select Pool"}
          </span>
          {selectedPool?.data.dexId && formatDexId(selectedPool.data.dexId) && (
            <span className={styles.sourceTag}>
              {formatDexId(selectedPool.data.dexId)}
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
                key={pool.data.poolAddress}
                className={classNames(styles.listItem, {
                  [styles.selected]:
                    selectedPool?.data.poolAddress === pool.data.poolAddress,
                })}
                onClick={() => handleSelect(pool)}
              >
                <div className={styles.colPair}>
                  <div className={styles.pairInfo}>
                    <div className={styles.pairName}>{pool.data.poolName}</div>
                    <div className={styles.pairSource}>
                      {formatDexId(pool.data.dexId ?? null)}
                    </div>
                  </div>
                </div>
                <div className={styles.colVol}>
                  {formatLargeNumber(Number(pool.data.volumeUsd24h) || 0)}
                </div>
                <div className={styles.colLiq}>
                  {formatLargeNumber(Number(pool.data.liquidityUsd) || 0)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
