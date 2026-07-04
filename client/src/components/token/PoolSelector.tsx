import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
import { dexLabel } from "@/util/format";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import classNames from "classnames";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import styles from "./PoolSelector.module.scss";

type TopPoolData = {
  poolAddress: string;
  poolName: string | null;
  dexId: string | null;
  volumeUsd24h: number | null;
  liquidityUsd: number | null;
};

interface PoolSelectorProps {
  pools: TopPoolData[];
  selectedPool: TopPoolData;
  onPoolChange: (address: string) => void;
}

export function PoolSelector({
  pools,
  selectedPool,
  onPoolChange,
}: PoolSelectorProps) {
  const { fmt, tr } = useLocalization();
  const { themeRef } = useUserTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside (either the trigger or the portaled dropdown)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const isInTrigger = !!containerRef.current?.contains(target);
      const isInDropdown = !!dropdownRef.current?.contains(target);
      if (!isInTrigger && !isInDropdown) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep the (portaled) dropdown anchored under the trigger while open
  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen]);

  if (!pools || pools.length == 0) return null;

  const handleSelect = (pool: TopPoolData) => {
    onPoolChange(pool.poolAddress);
    setIsOpen(false);
  };

  const dropdown = isOpen && (
    <div className={styles.dropdown} ref={dropdownRef} style={dropdownPosition}>
      <div className={styles.headerRow}>
        <span className={styles.colPair}>{tr("token.marketsTable.pair").toUpperCase()}</span>
        <span className={styles.colVol}>{tr("token.marketsTable.volume24h").toUpperCase()}</span>
        <span className={styles.colLiq}>{tr("token.marketsTable.liquidity").toUpperCase()}</span>
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
                <div className={styles.pairSource}>{dexLabel(pool.dexId)}</div>
              </div>
            </div>
            <div className={styles.colVol}>
              {fmt.num.compact.currency(pool.volumeUsd24h, true)}
            </div>
            <div className={styles.colLiq}>
              {fmt.num.compact.currency(pool.liquidityUsd, true)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={classNames(styles.selector, { [styles.active]: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
        ref={triggerRef}
      >
        <div className={styles.selectedContent}>
          <span className={styles.selectedName}>
            {selectedPool.poolName || tr("token.poolSelector.selectPool")}
          </span>
          {selectedPool.dexId && (
            <span className={styles.sourceTag}>{dexLabel(selectedPool.dexId)}</span>
          )}
        </div>
        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </div>

      {dropdown && (themeRef.current ? createPortal(dropdown, themeRef.current) : dropdown)}
    </div>
  );
}
