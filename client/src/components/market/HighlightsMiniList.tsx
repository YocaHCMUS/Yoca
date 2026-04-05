import { Link, Stack } from "@carbon/react";
import { ChevronRight } from "@carbon/react/icons";
import { TrendNum } from "../TrendNum";
import styles from "./HighlightsMiniList.module.scss";

interface HighlightsMiniListProps {
  title: string;
  icon?: React.ReactNode;
  moreLink?: string;
  items: {
    id: string;
    image?: string;
    label: string;
    subLabel?: string;
    valueText?: string;
    trendValue?: number | null;
    trendFormatter?: (val: number | null) => string;
    link?: string;
  }[];
  loading?: boolean;
}

export function HighlightsMiniList({
  title,
  icon,
  moreLink,
  items,
  loading,
}: HighlightsMiniListProps) {
  if (loading) {
    return (
      <div className={styles.miniListCard}>
        <div className={styles.header}>
          <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
            {icon}
            <h4 className={styles.title}>{title}</h4>
          </Stack>
        </div>
        <div className={styles.loadingContainer}>
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
          <div className={styles.skeletonRow} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.miniListCard}>
      <div className={styles.header}>
        <Stack orientation="horizontal" gap={2} style={{ alignItems: "center" }}>
          {icon}
          <h4 className={styles.title}>{title}</h4>
        </Stack>
        {moreLink && (
          <Link href={moreLink} className={styles.moreLink}>
            more <ChevronRight size={16} />
          </Link>
        )}
      </div>

      <div className={styles.listBody}>
        <div className={styles.listHeader}>
          <span>Coin</span>
          <div className={styles.rightHeader}>
            <span>Price</span>
            <span>24h</span>
          </div>
        </div>
        {items.map((item) => (
          <Link key={item.id} href={item.link || "#"} className={styles.listItem}>
            <div className={styles.itemInfo}>
              {item.image ? (
                <img src={item.image} alt={item.label} className={styles.itemImage} />
              ) : (
                <div className={styles.itemIconPlaceholder} />
              )}
              <div className={styles.labelGroup}>
                <span className={styles.label}>{item.label}</span>
                {item.subLabel && <span className={styles.subLabel}>{item.subLabel}</span>}
              </div>
            </div>
            <div className={styles.itemValues}>
              <span className={styles.mainValue}>{item.valueText || "-"}</span>
              <div className={styles.trend}>
              <TrendNum
                value={item.trendValue ?? null}
                formatter={item.trendFormatter || ((val) => (val?.toString() || "-"))}
              />
            </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
