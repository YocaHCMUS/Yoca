import classNames from "classnames";
import { type MarketData, type PoolData, type TopHoldersData, type HoldersInfo } from "../../hooks/useTokenPageData";
import styles from "./MarketStats.module.scss";

interface MarketStatsProps {
    data: NonNullable<MarketData>;
    pool: PoolData | null;
    topHolders?: TopHoldersData;
    holdersInfo?: HoldersInfo | null;
    marketsCount?: number;
    layout?: "vertical" | "horizontal";
}

export const MarketStats = ({ data, pool, topHolders, holdersInfo, marketsCount, layout = "vertical" }: MarketStatsProps) => {
    // Helper to format currency
    const formatCurrency = (value: number | null) => {
        if (value === null || value === undefined) return "-";
        return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`;
    };

    const formatNumber = (value: number | null) => {
        if (value === null || value === undefined) return "-";
        if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
        if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
        return `$${value.toFixed(2)}`;
    };

    const formatNumberCompact = (value: number | null) => {
        if (value === null || value === undefined) return "-";
        const absValue = Math.abs(value);
        if (absValue >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
        if (absValue >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
        if (absValue >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
        return value.toFixed(0);
    };

    const formatPercent = (value: number | null) => {
        if (value === null || value === undefined) return "-";
        return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
    };

    const top10HoldersPercent = holdersInfo?.top_10_percent
        ? holdersInfo.top_10_percent
        : (topHolders?.reduce((acc, curr) => acc + curr.percentageOfSupply, 0) ?? 0);

    return (
        <div className={classNames(styles.container, { [styles.horizontal]: layout === "horizontal" })}>

            {/* ROW 1: Prices */}
            <div className={styles.gridRow}>
                <div className={styles.gridCell}>
                    <span className={styles.label}>PRICE USD</span>
                    <div className={styles.pricesContainer}>
                        <span className={styles.valueLarge}>
                            {formatCurrency(pool?.priceUsd || data.priceUsd)}
                        </span>
                    </div>
                </div>
                {pool && (
                    <div className={styles.gridCell}>
                        <span className={styles.label}>
                            PRICE {pool?.baseToken?.symbol?.toUpperCase() || pool?.name?.split('/')?.[0]?.trim() || "TOKEN"}/{pool?.quoteToken?.symbol?.toUpperCase() || "USD"}
                        </span>
                        <div className={styles.pricesContainer}>
                            <span className={styles.valueLarge}>
                                {pool.priceQuoteToken ? pool.priceQuoteToken.toFixed(6) : "-"}
                            </span>
                        </div>
                    </div>
                )}
            </div>

            {/* ROW 2: Key Stats */}
            <div className={styles.gridRow}>
                <div className={styles.gridCell}>
                    <span className={styles.label}>LIQUIDITY</span>
                    <span className={styles.valueMedium}>${formatNumberCompact(pool?.liquidity ?? 0)}</span>
                </div>
                <div className={styles.gridCell}>
                    <span className={styles.label}>MARKET CAP</span>
                    <span className={styles.valueMedium}>{formatNumber(pool ? (pool.marketCap ?? null) : data.marketCap)}</span>
                </div>
                <div className={styles.gridCell}>
                    <span className={styles.label}>FDV</span>
                    <span className={styles.valueMedium}>{formatNumber(pool ? (pool.fdv ?? null) : data.fullyDilutedValuation)}</span>
                </div>
            </div>

            {/* ROW 3: Period Changes */}
            <div className={styles.gridRow}>
                {pool ? (
                    <>
                        <div className={styles.gridCell}>
                            <span className={styles.label}>5M</span>
                            <span className={classNames(styles.valueMedium, {
                                [styles.positive]: (pool.priceChange?.m5 ?? 0) >= 0,
                                [styles.negative]: (pool.priceChange?.m5 ?? 0) < 0
                            })}>
                                {formatPercent(pool.priceChange?.m5 ?? null)}
                            </span>
                        </div>
                        <div className={styles.gridCell}>
                            <span className={styles.label}>1H</span>
                            <span className={classNames(styles.valueMedium, {
                                [styles.positive]: (pool.priceChange?.h1 ?? 0) >= 0,
                                [styles.negative]: (pool.priceChange?.h1 ?? 0) < 0
                            })}>
                                {formatPercent(pool.priceChange?.h1 ?? null)}
                            </span>
                        </div>
                        <div className={styles.gridCell}>
                            <span className={styles.label}>6H</span>
                            <span className={classNames(styles.valueMedium, {
                                [styles.positive]: (pool.priceChange?.h6 ?? 0) >= 0,
                                [styles.negative]: (pool.priceChange?.h6 ?? 0) < 0
                            })}>
                                {formatPercent(pool.priceChange?.h6 ?? null)}
                            </span>
                        </div>
                        <div className={styles.gridCell}>
                            <span className={styles.label}>24H</span>
                            <span className={classNames(styles.valueMedium, {
                                [styles.positive]: (pool.priceChange?.h24 ?? 0) >= 0,
                                [styles.negative]: (pool.priceChange?.h24 ?? 0) < 0
                            })}>
                                {formatPercent(pool.priceChange?.h24 ?? null)}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className={styles.gridCell}>
                        <span className={styles.label}>24H CHANGE</span>
                        <span className={classNames(styles.valueMedium, {
                            [styles.positive]: (data.priceChangePercentage24h ?? 0) >= 0,
                            [styles.negative]: (data.priceChangePercentage24h ?? 0) < 0
                        })}>
                            {formatPercent(data.priceChangePercentage24h)}
                        </span>
                    </div>
                )}
            </div>

            {/* ROW 4: 24H VOL Breakdown (Label | Buy | Sell | Net) - 4 Cols */}
            {pool && (
                <div className={styles.gridRow}>
                    <div className={styles.gridCellLeft}>
                        <span className={styles.label}>24H VOL</span>
                        <span className={styles.valueMedium}>${formatNumberCompact(pool.volume24h ?? 0)}</span>
                    </div>
                    {/* Buy */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>BUY</span>
                        <span className={styles.buyColor}>${formatNumberCompact(pool.volumeBuy24h ?? 0)}</span>
                    </div>
                    {/* Sell */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>SELL</span>
                        <span className={styles.sellColor}>${formatNumberCompact(pool.volumeSell24h ?? 0)}</span>
                    </div>
                    {/* Net */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>NET</span>
                        <span className={classNames(styles.valueSmall, {
                            [styles.positive]: (pool.volumeNet24h ?? 0) >= 0,
                            [styles.negative]: (pool.volumeNet24h ?? 0) < 0
                        })}>
                            ${formatNumberCompact(pool.volumeNet24h ?? 0)}
                        </span>
                    </div>
                </div>
            )}

            {/* ROW 5: 24H TXNS Breakdown (Label | Buy | Sell | Net) - 4 Cols */}
            {pool && (
                <div className={styles.gridRow}>
                    <div className={styles.gridCellLeft}>
                        <span className={styles.label}>24H TXNS</span>
                        <span className={styles.valueMedium}>{formatNumberCompact(pool.txns24h ?? 0)}</span>
                    </div>
                    {/* Buy */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>BUY</span>
                        <span className={styles.buyColor}>{formatNumberCompact(pool.buys24h ?? 0)}</span>
                    </div>
                    {/* Sell */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>SELL</span>
                        <span className={styles.sellColor}>{formatNumberCompact(pool.sells24h ?? 0)}</span>
                    </div>
                    {/* Net */}
                    <div className={styles.gridCellRight}>
                        <span className={styles.label}>NET</span>
                        <span className={classNames(styles.valueSmall, {
                            [styles.positive]: (pool.buys24h ?? 0) >= (pool.sells24h ?? 0),
                            [styles.negative]: (pool.buys24h ?? 0) < (pool.sells24h ?? 0)
                        })}>
                            {formatNumberCompact((pool.buys24h ?? 0) - (pool.sells24h ?? 0))}
                        </span>
                    </div>
                </div>
            )}

            {/* ROW 6: Traders (Full width with space between) */}
            {pool && (
                <div className={classNames(styles.gridRow, styles.singleItemRow)}>
                    <span className={styles.label}>24H TRADERS</span>
                    <span className={styles.valueLarge}>{formatNumberCompact(pool.traders24h ?? 0)}</span>
                </div>
            )}

            {/* ROW 8: Holders */}
            <div className={styles.gridRow}>
                <div className={styles.gridCell}>
                    <span className={styles.label}>TOP 10 HOLDERS</span>
                    <span className={styles.valueMedium}>{top10HoldersPercent.toFixed(2)}%</span>
                </div>
                <div className={styles.gridCell}>
                    <span className={styles.label}>HOLDERS</span>
                    <span className={styles.valueMedium}>{holdersInfo?.holders_count ? formatNumberCompact(holdersInfo.holders_count) : "-"}</span>
                </div>
            </div>

            {/* ROW 9: Supply & Markets */}
            <div className={styles.gridRow}>
                <div className={styles.gridCell}>
                    <span className={styles.label}>CIRC SUPPLY</span>
                    <span className={styles.valueMedium}>{formatNumberCompact(data.circulatingSupply)}</span>
                </div>
                <div className={styles.gridCell}>
                    <span className={styles.label}>TOTAL SUPPLY</span>
                    <span className={styles.valueMedium}>{formatNumberCompact(data.totalSupply)}</span>
                </div>
                <div className={styles.gridCell}>
                    <span className={styles.label}>MARKETS</span>
                    <span className={styles.valueMedium}>{marketsCount ?? "-"}</span>
                </div>
            </div>

        </div>
    );
};
