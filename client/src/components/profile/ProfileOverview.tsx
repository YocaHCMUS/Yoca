import {
    SUBSCRIPTION_TIER_LABELS,
    SUBSCRIPTION_TIER_TAG_KIND
} from "@/components/profile/profile.constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { getUserSubscription, type PlanTier } from "@/services/profile/subscriptionApi";
import type { TimePeriod } from "@/types/chart-filters.types";
import type { ProfileOverviewData } from "@/types/profile";
import { SkeletonPlaceholder, SkeletonText, Tag } from "@carbon/react";
import { Activity, ChartLine, Wallet } from "@carbon/react/icons";
import { useEffect, useState } from "react";
import styles from "./profile.module.scss";

interface ProfileOverviewProps {
  data: ProfileOverviewData;
  onPeriodChange: (period: TimePeriod) => void;
  loading: boolean;
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function ProfileOverview({
  data,
  onPeriodChange,
  loading,
}: ProfileOverviewProps) {
  const { fmt } = useLocalization();
  const [subscriptionTier, setSubscriptionTier] = useState<PlanTier | "Standard">(
    "Standard",
  );
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const subscription = await getUserSubscription();
        setSubscriptionTier(subscription?.planTier ?? "Standard");
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
        setSubscriptionTier("Standard");
      } finally {
        setSubscriptionLoading(false);
      }
    };

    fetchSubscription();
  }, []);

  return (
    <section className={styles.sectionCard}>
      <div className={styles.overviewHeader}>
        <div className={styles.overviewIdentity}>
          {loading ? (
            <SkeletonPlaceholder
              style={{ width: 56, height: 56, borderRadius: "999px" }}
            />
          ) : (
            <img
              className={styles.avatar}
              src={data.avatarUrl}
              alt={`${data.displayName} avatar`}
            />
          )}
          <div>
            {loading ? (
              <div>
                <SkeletonText width="10rem" />
                <SkeletonText width="4.5rem" />
              </div>
            ) : (
              <>
                <h2>{data.displayName}</h2>
                {data.userId ? (
                  <p className={styles.overviewUid}>UID: {data.userId}</p>
                ) : null}
                <Tag type={SUBSCRIPTION_TIER_TAG_KIND[subscriptionTier]}>
                  {SUBSCRIPTION_TIER_LABELS[subscriptionTier]}
                </Tag>
              </>
            )}
          </div>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>
            <Wallet size={16} />
            Total Value
          </p>
          <p className={styles.metricValue}>
            {loading ? (
              <SkeletonText width="6rem" />
            ) : (
              fmt.num.compact.currency(data.totalNetWorthUsd)
            )}
          </p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>
            <Activity size={16} />
            Trades or transactions
          </p>
          <p className={styles.metricValue}>
            {loading ? (
              <SkeletonText width="4rem" />
            ) : (
              data.tradeOrTxCount.toLocaleString()
            )}
          </p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>
            <ChartLine size={16} />
            Profit and loss
          </p>
          <p
            className={`${styles.metricValue} ${
              data.pnlUsd >= 0 ? styles.positive : styles.negative
            }`}
          >
            {loading ? (
              <SkeletonText width="7rem" />
            ) : (
              `${fmt.num.compact.currency(data.pnlUsd)} (${formatPct(data.pnlPct)})`
            )}
          </p>
        </div>
      </div>
    </section>
  );
}

export default ProfileOverview;
