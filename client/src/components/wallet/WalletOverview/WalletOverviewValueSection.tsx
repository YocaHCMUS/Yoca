
import styles from './WalletOverview.module.scss';
import { useLocalization } from '@/contexts/LocalizationContext';
import { FinancialAssets } from '@carbon/react/icons';
import { renderValue } from './valueRenderer';

export interface WalletOverviewValueSectionProps {
    value: number | null;
    unrealizedPnlInPeriod: number | null | undefined;
    loading: boolean;
}

const WalletOverviewValueSection = ({ value, unrealizedPnlInPeriod, loading }: WalletOverviewValueSectionProps) => {
    const { tr, fmt } = useLocalization();

    // Calculate PnL percentage change
    const hasPnl = unrealizedPnlInPeriod != null && unrealizedPnlInPeriod !== 0;
    const beforeValue = value != null && unrealizedPnlInPeriod != null
        ? value + unrealizedPnlInPeriod
        : null;

    const pnlPercentage = hasPnl && beforeValue != null && beforeValue !== 0
        ? (unrealizedPnlInPeriod! / beforeValue) * 100
        : 0;

    const isPositive = hasPnl && unrealizedPnlInPeriod! > 0;
    const isNegative = hasPnl && unrealizedPnlInPeriod! < 0;
    const pnlClass = isPositive ? styles.subStatValuePositive : isNegative ? styles.subStatValueNegative : '';

    return (
        <div className={styles.statRow}>
            <div className={styles.statLabel}>
                <FinancialAssets />
                {tr('wallet.totalAssetValue')}
            </div>
            <div className={styles.alignedStatRow}>
                {renderValue(
                    value != null,
                    fmt.num.compact.currency(value != null ? parseFloat(value.toFixed(6)) : null),
                    [styles.statValue],
                    '88px',
                    '14px',
                    loading
                )}
                {hasPnl && (
                    <div className={`${styles.subStatLabel} ${styles.subScript} ${pnlClass}`}>
                        {isPositive ? "▲" : isNegative ? "▼" : ""}{" "}
                        {`${pnlPercentage.toFixed(2)}%`}
                    </div>
                )}
            </div>
        </div>
    )
}

export default WalletOverviewValueSection;