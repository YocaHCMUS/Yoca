import { Analytics } from '@carbon/react/icons';
import { renderValue } from './valueRenderer';
import styles from './WalletOverview.module.scss';
import { useLocalization } from '@/contexts/LocalizationContext';

export interface WalletOverviewPnLSectionProps {
    totalPnL: number | null;
    realizedPnL: number | null;
    unrealizedPnL: number | null;
    loading: boolean;
}

function PnlCard({
    label,
    value,
    loading,
}: {
    label: string;
    value: number | null;
    loading: boolean;
}) {
    const { fmt } = useLocalization();
    const isPositive = value != null && value >= 0;
    const valueClass = isPositive ? styles.pnlCardValuePositive : styles.pnlCardValueNegative;

    return (
        <div className={styles.Card}>
            <div className={styles.CardLabel}>{label}</div>
            <div className={styles.CardValueRow}>
                <span className={valueClass}>
                    {renderValue(
                        value != null,
                        fmt.num.currency(value != null ? parseFloat(value.toFixed(6)) : null),
                        [styles.statValue, valueClass],
                        '88px',
                        '14px',
                        loading
                    )}
                </span>
            </div>
        </div>
    );
}

const WalletOverviewPnLSection = ({ totalPnL, realizedPnL, unrealizedPnL, loading }: WalletOverviewPnLSectionProps) => {
    const { tr, fmt } = useLocalization();
    const hasTotal = totalPnL != null;
    const isTotalPositive = totalPnL != null && totalPnL >= 0;

    return (
        <div className={styles.statColumn}>
            <div className={styles.statRow}>
                <div className={styles.statLabel}>
                    <Analytics />
                    <div className={styles.statLabel}>PnL Overview</div>
                </div>
            </div>

            <div className={styles.statRow}>
                <span className={styles.statLabel}>{tr('wallet.totalPnL')}:</span>
                {renderValue(
                    totalPnL != null,
                    fmt.num.currency(totalPnL != null ? parseFloat(totalPnL.toFixed(6)) : null),
                    [styles.statValue, isTotalPositive ? styles.pnlTotalValuePositive : styles.pnlTotalValueNegative],
                    '88px',
                    '14px',
                    loading
                )}
            </div>

            <div className={styles.statRow}>
                <PnlCard
                    label={tr('wallet.realizedPnL')}
                    value={realizedPnL}
                    loading={loading}
                />
                <PnlCard
                    label={tr('wallet.unrealizedPnL')}
                    value={unrealizedPnL}
                    loading={loading}
                />
            </div>
        </div>
    );
};

export default WalletOverviewPnLSection;
