import { dexLabel } from "@/util/format";
import type { InferResponseType } from "hono/client";
import client from "@/api/main";
import styles from "./PoolResultItem.module.scss";

type SearchResult = InferResponseType<typeof client.api.search.$get, 200>;
export type PoolResult = SearchResult["pools"][number] & {
    baseTokenImg?: string | null;
    quoteTokenImg?: string | null;
};

interface PoolResultItemProps {
    pool: PoolResult;
    isFocused: boolean;
    onSelect: (pool: PoolResult) => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
}

export function PoolResultItem({
    pool,
    isFocused,
    onSelect,
    onMouseEnter,
    onMouseLeave,
}: PoolResultItemProps) {
    const attributes = pool.attributes;

    return (
        <div
            className={`${styles.resultItem} ${isFocused ? styles.focused : ""}`}
            onClick={() => onSelect(pool)}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className={styles.tokenPair}>
                {pool.baseTokenImg ? (
                    <img
                        src={pool.baseTokenImg}
                        alt=""
                        className={styles.pairImg}
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                    />
                ) : (
                    <div className={styles.pairPlaceholder}>?</div>
                )}
                {pool.quoteTokenImg ? (
                    <img
                        src={pool.quoteTokenImg}
                        alt=""
                        className={`${styles.pairImg} ${styles.quote}`}
                        onError={(e) => (e.currentTarget.style.visibility = "hidden")}
                    />
                ) : (
                    <div className={`${styles.pairPlaceholder} ${styles.quote}`}>?</div>
                )}
            </div>

            <div className={styles.tokenMeta}>
                <p className={styles.poolName}>{attributes?.name || "Unknown Pool"}</p>
                <p className={styles.dexLabel}>{dexLabel(pool.relationships?.dex?.data?.id)}</p>
            </div>
        </div>
    );
}
