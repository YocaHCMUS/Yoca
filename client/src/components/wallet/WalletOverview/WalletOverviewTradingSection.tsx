
import styles from './WalletOverview.module.scss';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ChartColumn } from '@carbon/react/icons';
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
    const hasCountSplit = buyCount + sellCount > 0;

    const tradingVolumeToDisplay = (
        <span>
            <span className={styles.subStatValuePositive}>{fmt.num.compact.currency(buyVolume)}</span> / <span className={styles.subStatValueNegative}>{fmt.num.compact.currency(sellVolume)}</span>
        </span>
    )

    const tradingCountToDisplay = (
        <span>
            <span className={styles.subStatValuePositive}>{fmt.num.decimal(buyCount)}</span> / <span className={styles.subStatValueNegative}>{fmt.num.decimal(sellCount)}</span>
        </span>
    )


    return (
        <div className={styles.statColumn}>
            <div className={styles.statRow}>
                <div className={styles.statLabel}>
                    <ChartColumn />
                    {tr('wallet.tradingVolume')}
                </div>

                {renderValue(
                    tradingVolume != null,
                    fmt.num.compact.currency(tradingVolume != null ? parseFloat(tradingVolume.toFixed(6)) : null),
                    [styles.statValue],
                    '88px',
                    '14px',
                    loading
                )}
            </div>

            <div className={styles.subStatRow} style={{ padding: '12px 12px', borderTop: '1px solid var(--cds-border-subtle)', gap: '6px' }}>
                <div className={styles.subStatLabel}>{`${tr('wallet.tradingVolume')} (${tr('walletPage.buy')}/${tr('walletPage.sell')})`}</div>
                {renderValue(
                    hasVolumeSplit,
                    tradingVolumeToDisplay,
                    [styles.subStatValue],
                    '52px',
                    '12px',
                    loading
                )}
            </div>

            <div className={styles.subStatRow} style={{ padding: '12px 12px', borderTop: '1px solid var(--cds-border-subtle)', gap: '6px' }}>
                <div className={styles.subStatLabel}>{`${tr('wallet.transactionCount')} (${tr('walletPage.buy')}/${tr('walletPage.sell')})`}</div>
                {renderValue(
                    hasCountSplit,
                    tradingCountToDisplay,
                    [styles.subStatValue],
                    '52px',
                    '12px',
                    loading
                )}
            </div>

            <div className={styles.cardsRow}>
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