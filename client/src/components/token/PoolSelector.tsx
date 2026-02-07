import { useState, useRef, useEffect } from "react";
import classNames from "classnames";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import type { PoolData } from "@/hooks/useTokenPageData";
import { formatLargeNumber } from "@/services/coingecko";
import styles from "./PoolSelector.module.scss";

interface PoolSelectorProps {
    pools: PoolData[];
    selectedPool: PoolData | null;
    onPoolChange: (item: { selectedItem: PoolData | null }) => void;
}

export const PoolSelector = ({ pools, selectedPool, onPoolChange }: PoolSelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    if (!pools || pools.length === 0) return null;

    const handleSelect = (pool: PoolData) => {
        onPoolChange({ selectedItem: pool });
        setIsOpen(false);
    };

    const formatSource = (source?: string): string | null => {
        if (!source || source.toLowerCase() === "unknown") return null;
        // Capitalize first letter of each word
        return source.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <div
                className={classNames(styles.selector, { [styles.active]: isOpen })}
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className={styles.selectedContent}>
                    <span className={styles.selectedName}>{selectedPool?.name || "Select Pool"}</span>
                    {selectedPool?.source && formatSource(selectedPool.source) && (
                        <span className={styles.sourceTag}>{formatSource(selectedPool.source)}</span>
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
                        {pools.map(pool => (
                            <div
                                key={pool.address}
                                className={classNames(styles.listItem, { [styles.selected]: selectedPool?.address === pool.address })}
                                onClick={() => handleSelect(pool)}
                            >
                                <div className={styles.colPair}>
                                    <div className={styles.pairInfo}>
                                        <div className={styles.pairName}>{pool.name}</div>
                                        <div className={styles.pairSource}>{formatSource(pool.source)}</div>
                                    </div>
                                </div>
                                <div className={styles.colVol}>
                                    {formatLargeNumber(pool.volume24h)}
                                </div>
                                <div className={styles.colLiq}>
                                    {formatLargeNumber(pool.liquidity || 0)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
