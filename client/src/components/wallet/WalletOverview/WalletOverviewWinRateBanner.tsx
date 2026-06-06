import React, { useState } from 'react';
import { Information, Close } from '@carbon/react/icons';
import { SkeletonPlaceholder } from '@carbon/react';
import styles from './WalletOverviewWinRateBanner.module.scss';

interface Props {
    stats?: any; // Dùng any tạm thời trong lúc chờ Backend định nghĩa type
    selectedPeriod: string;
    loading: boolean;
}

const WalletOverviewWinRateBanner: React.FC<Props> = ({ stats, selectedPeriod, loading }) => {
    const [isDisclaimerOpen, setIsDisclaimerOpen] = useState(false);

    if (loading) return <SkeletonPlaceholder className={styles.bannerSkeleton} />;

    // NẾU KHÔNG CÓ DATA THẬT -> Không render hoặc hiển thị "N/A"
    if (!stats || stats.totalTraded === 0) {
        return (
            <div className={styles.bannerContainer} style={{ textAlign: 'center', padding: '20px' }}>
                <span className={styles.title}>Token Win Rate</span>
                <p>No trade data available for this period.</p>
            </div>
        );
    } 

    const { winRate, winCount, totalTraded, avgWinUsd, avgLossUsd } = stats;
    const isHighWinRate = winRate >= 50;

    return (
        <div className={styles.bannerContainer}>
            <div className={styles.header}>
                <span className={styles.title}>Token Win Rate</span>
                <button 
                    className={styles.infoIconBtn} 
                    onClick={() => setIsDisclaimerOpen(!isDisclaimerOpen)}
                    aria-label="Toggle disclaimer"
                    aria-expanded={isDisclaimerOpen}
                >
                    {isDisclaimerOpen ? <Close size={16} /> : <Information size={16} />}
                </button>
            </div>

            {isDisclaimerOpen && (
                <div className={styles.disclaimerBox}>
                    <p>
                        * <strong>Win Rate</strong> là tỷ lệ số lượng token có lãi (Realized PnL &gt; 0) trên tổng số token đã giao dịch trong khoảng thời gian <strong>{selectedPeriod}</strong>.
                    </p>
                </div>
            )}

            <div className={styles.contentGrid}>
                {/* Vùng 1: Win Rate & Progress */}
                <div className={styles.mainRateCol}>
                    <div className={styles.rateValue} style={{ color: isHighWinRate ? 'var(--cds-support-success, #24a148)' : 'var(--cds-support-error, #da1e28)' }}>
                        {winRate.toFixed(1)}%
                    </div>
                    <div className={styles.progressBarContainer}>
                        <div className={styles.progressWin} style={{ width: `${winRate}%` }} />
                        <div className={styles.progressLoss} style={{ width: `${100 - winRate}%` }} />
                    </div>
                    <div className={styles.tokenCounts}>
                        <span className={styles.winText}>{winCount} win</span> / {totalTraded} traded
                    </div>
                </div>

                <div className={styles.divider} />

                {/* Vùng 2: Avg Win */}
                <div className={styles.metricCol}>
                    <div className={styles.metricLabel}>Avg Win</div>
                    <div className={styles.metricValueWin}>
                        +${Math.abs(avgWinUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>

                {/* Vùng 3: Avg Loss */}
                <div className={styles.metricCol}>
                    <div className={styles.metricLabel}>Avg Loss</div>
                    <div className={styles.metricValueLoss}>
                        -${Math.abs(avgLossUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WalletOverviewWinRateBanner;