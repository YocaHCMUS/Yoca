import {
    ACCOUNT_TIER_LABELS,
    ACCOUNT_TIER_TAG_KIND,
} from "@/components/profile/profile.constants";
import type { ProfileOverviewData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { SkeletonPlaceholder, SkeletonText, Tag } from "@carbon/react";
import {
    Wallet,
    Activity,
    ChartLine,
    Link as LinkIcon,
} from "@carbon/react/icons";
import styles from "./profile.module.scss";
import { PeriodSelector } from "../common/PeriodSelector/PeriodSelector";


interface ProfileOverviewProps {
    data: ProfileOverviewData;
    onPeriodChange: (period: TimePeriod) => void;
    loading: boolean;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
    }).format(value);
}

function formatPct(value: number): string {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
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
                        Total net worth
                    </p>
                    <p className={styles.metricValue}>
                        {loading ? <SkeletonText width="6rem" /> : formatCurrency(data.totalNetWorthUsd)}
                    </p>
                </div>
                <div className={styles.metricCard}>
                    <p className={styles.metricLabel}>
                        <Activity size={16} />
                        Trades or transactions
                    </p>
                    <p className={styles.metricValue}>
                        {loading ? <SkeletonText width="4rem" /> : data.tradeOrTxCount.toLocaleString()}
                    </p>
                </div>
                <div className={styles.metricCard}>
                    <p className={styles.metricLabel}>
                        <ChartLine size={16} />
                        Profit and loss
                    </p>
                    <p
                        className={`${styles.metricValue} ${data.pnlUsd >= 0 ? styles.positive : styles.negative
                            }`}
                    >
                        {loading ? <SkeletonText width="7rem" /> : `${formatCurrency(data.pnlUsd)} (${formatPct(data.pnlPct)})`}
                    </p>
                </div>
                <div className={styles.metricCard}>
                    <p className={styles.metricLabel}>
                        <LinkIcon size={16} />
                        Linked wallets
                    </p>
                    <p className={styles.metricValue}>
                        {loading ? <SkeletonText width="3rem" /> : data.linkedWalletCount}
                    </p>
                </div>
            </div>
        </section>
    );
}

export default ProfileOverview;
