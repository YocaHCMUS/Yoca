import {
    SUBSCRIPTION_TIER_LABELS,
    SUBSCRIPTION_TIER_TAG_KIND
} from "@/components/profile/shared/profile.constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import type { ProfileOverviewData } from "@/types/profile";
import { SkeletonPlaceholder, SkeletonText, Tag } from "@carbon/react";
import { Activity, ChartLine, Wallet, Link as LinkIcon } from "@carbon/react/icons";
import styles from "@/components/profile/shared/profile.module.scss";
interface ProfileOverviewProps {
  data: ProfileOverviewData;
  loading: boolean;
}

export function ProfileOverview({ data, loading }: ProfileOverviewProps) {
  const { fmt } = useLocalization();
  const { user } = useAuth();
  const subscriptionTier =
    !user || user.planTier == "Free" ? "Standard" : user.planTier;

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

      {/* Temporarily hidden as requested
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
              `${fmt.num.compact.currency(data.pnlUsd)} (${fmt.num.percent(data.pnlPct)})`
            )}
          </p>
        </div>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>
              <LinkIcon size={16} />
              Authorized wallets
          </p>
          <div className={styles.metricValue}>
              {loading ? <SkeletonText width="3rem" /> : data.authWalletCount}
          </div>
        </div>
      </div>
      */}
    </section>
  );
}

export default ProfileOverview;
