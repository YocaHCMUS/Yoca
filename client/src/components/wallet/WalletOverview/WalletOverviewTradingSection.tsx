
import styles from './WalletOverview.module.scss';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ChartColumn, Currency } from '@carbon/react/icons';
import { renderValue } from './valueRenderer';


export interface WalletOverviewTradingSectionProps {
    tradingVolume: number | null;
    buyTradingVolume: number | null;
    sellTradingVolume: number | null;
    buyTransactionCount: number | null;
    sellTransactionCount: number | null;
    tokenAmountTraded: number | null;
    tokenAmountHolding: number | null;
    loading: boolean;
}

function HoldingCard({
    label,
    value,
    loading,
}: {
    label: string;
    value: number | null;
    loading: boolean;
}) {
    const { fmt } = useLocalization();
    return (
        <div className={styles.Card}>
            <div className={styles.CardLabel}>{label}</div>
            <div className={styles.CardValueRow}>
                {renderValue(
                    value != null,
                    fmt.num.decimal(value != null ? parseFloat(value.toFixed(6)) : null),
                    [styles.statValue],
                    '88px',
                    '14px',
                    loading
                )}
            </div>
        </div>
    );
}

const WalletOverviewTradingSection = ({ tradingVolume, buyTradingVolume, sellTradingVolume, buyTransactionCount, sellTransactionCount, tokenAmountTraded, tokenAmountHolding, loading }: WalletOverviewTradingSectionProps) => {
    const { tr, fmt } = useLocalization();

    const buyVolume = buyTradingVolume ?? 0;
    const sellVolume = sellTradingVolume ?? 0;
    const totalVolume = buyVolume + sellVolume;
    const hasVolumeSplit = totalVolume > 0;

    const buyCount = buyTransactionCount ?? 0;
    const sellCount = sellTransactionCount ?? 0;

    return (
        <div className={styles.statColumn}>
            <div className={styles.statRow}>
                <div className={styles.statLabel}>
                    <ChartColumn />
                    {tr('wallet.tradingVolume')}
                </div>

                {renderValue(
                    tradingVolume != null,
                    fmt.num.currency(tradingVolume != null ? parseFloat(tradingVolume.toFixed(6)) : null),
                    [styles.statValue],
                    '88px',
                    '14px',
                    loading
                )}
            </div>

            <div className={styles.statRow}>
                <div className={styles.subStatLabel}>{tr('wallet.tradingVolume')}</div>
                <div>
                    {renderValue(
                        hasVolumeSplit,
                        `${fmt.num.currency(buyVolume)}`,
                        [styles.subStatValue, styles.subStatValuePositive],
                        '52px',
                        '12px',
                        loading
                    )}
                    /
                    {renderValue(
                        hasVolumeSplit,
                        `${fmt.num.currency(sellVolume)}`,
                        [styles.subStatValue, styles.subStatValueNegative],
                        '52px',
                        '12px',
                        loading
                    )}

                </div>
            </div>

            <div className={styles.statRow}>
                <div className={styles.subStatLabel}>{tr('wallet.transactionCount')}</div>
                <div>
                    {renderValue(
                        hasVolumeSplit,
                        `${fmt.num.decimal(buyCount)}`,
                        [styles.subStatValue, styles.subStatValuePositive],
                        '52px',
                        '12px',
                        loading
                    )}
                    /
                    {renderValue(
                        hasVolumeSplit,
                        `${fmt.num.decimal(sellCount)}`,
                        [styles.subStatValue, styles.subStatValueNegative],
                        '52px',
                        '12px',
                        loading
                    )}

                </div>
            </div>

            <div className={styles.statRow}>
                <HoldingCard
                    label={tr('wallet.tokensTraded')}
                    value={tokenAmountTraded}
                    loading={loading} />

                <HoldingCard
                    label={tr('wallet.tokensHolding')}
                    value={tokenAmountHolding}
                    loading={loading} />

            </div>
        </div>
    );
};

export default WalletOverviewTradingSection;