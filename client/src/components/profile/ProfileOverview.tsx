import {
    ACCOUNT_TIER_LABELS,
    ACCOUNT_TIER_TAG_KIND,
} from "@/components/profile/profile.constants";
import type { ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { SkeletonPlaceholder, SkeletonText, Tag } from "@carbon/react";
import { Link as LinkIcon, Wallet } from "@carbon/react/icons";
import styles from "./profile.module.scss";
import { PeriodSelector } from "../common/PeriodSelector/PeriodSelector";


interface ProfileOverviewProps {
    data: ProfileOverviewData;
    onPeriodChange: (period: TimePeriod) => void;
    loading: boolean;
}

export function ProfileOverview({ data, onPeriodChange, loading }: ProfileOverviewProps) {
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
                                {data.userId ? <p className={styles.overviewUid}>UID: {data.userId}</p> : null}
                                <Tag type={ACCOUNT_TIER_TAG_KIND[data.accountTier]}>
                                    {ACCOUNT_TIER_LABELS[data.accountTier]}
                                </Tag>
                            </>
                        )}
                    </div>
                </div>

                <PeriodSelector
                    value={data.period}
                    onChange={(k) => onPeriodChange(k)}
                />
            </div>

            <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                    <p className={styles.metricLabel}>
                        <Wallet size={16} />
                        Linked wallets
                    </p>
                    <div className={styles.metricValue}>
                        {loading ? <SkeletonText width="3rem" /> : data.linkedWalletCount}
                    </div>
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
        </section>
    );
}

export default ProfileOverview;
