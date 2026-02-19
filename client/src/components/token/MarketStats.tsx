import { client } from "@/api/main";
import classNames from "classnames";
import type { InferResponseType } from "hono/client";
import styles from "./MarketStats.module.scss";

type PoolData = InferResponseType<
  (typeof client.api.tokens.pools)[":addresses"]["$get"],
  200
>[number];

type MarketData =
  | InferResponseType<
      (typeof client.api.tokens.markets)[":addresses"]["$get"],
      200
    >[number]
  | null;

type TopHoldersData = InferResponseType<
  (typeof client.api.tokens.holders)[":address"]["$get"],
  200
>;

type HoldersInfo =
  | InferResponseType<
      (typeof client.api.tokens.holders.stats)[":addresses"]["$get"],
      200
    >[number]
  | null;

interface MarketStatsProps {
  data: MarketData;
  pool: PoolData | null;
  topHolders?: TopHoldersData;
  holdersInfo?: HoldersInfo | null;
  marketsCount?: number;
  layout?: "vertical" | "horizontal";
}

export const MarketStats = ({
  data,
  pool,
  topHolders,
  holdersInfo,
  marketsCount,
  layout = "vertical",
}: MarketStatsProps) => {
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

  const formatNumberCompact = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "-";
    const absValue = Math.abs(value);
    if (absValue >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
    if (absValue >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (absValue >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
    return value.toFixed(0);
  };

  const formatDollarCompact = (value: number | null | undefined) => {
    if (value == null) return "-";
    return `$${formatNumberCompact(value)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  const top10HoldersPercent = holdersInfo?.top10Percent
    ? Number(holdersInfo.top10Percent)
    : (topHolders?.reduce((acc, curr) => acc + curr.percentage, 0) ?? 0);

  return (
    <div
      className={classNames(styles.container, {
        [styles.horizontal]: layout === "horizontal",
      })}
    >
      {/* ROW 1: Prices */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>PRICE USD</span>
          <div className={styles.pricesContainer}>
            <span className={styles.valueLarge}>
              {formatCurrency(
                pool?.priceUsd
                  ? Number(pool.priceUsd)
                  : data?.priceUsd
                    ? Number(data.priceUsd)
                    : null,
              )}
            </span>
          </div>
        </div>
        {pool && (
          <div className={styles.gridCell}>
            <span className={styles.label}>PRICE BASE/QUOTE</span>
            <div className={styles.pricesContainer}>
              <span className={styles.valueLarge}>
                {pool.baseToQuote ? Number(pool.baseToQuote).toFixed(6) : "-"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ROW 2: Key Stats */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>LIQUIDITY</span>
          <span className={styles.valueMedium}>
            {formatDollarCompact(
              pool?.liquidityUsd ? Number(pool.liquidityUsd) : null,
            )}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>MARKET CAP</span>
          <span className={styles.valueMedium}>
            {formatNumber(
              pool?.marketCapUsd
                ? Number(pool.marketCapUsd)
                : data?.marketCap
                  ? Number(data.marketCap)
                  : null,
            )}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>FDV</span>
          <span className={styles.valueMedium}>
            {formatNumber(
              pool?.fdvUsd
                ? Number(pool.fdvUsd)
                : data?.fullyDilutedValuation
                  ? Number(data.fullyDilutedValuation)
                  : null,
            )}
          </span>
        </div>
      </div>

      {/* ROW 3: Period Changes */}
      <div className={styles.gridRow}>
        {pool ? (
          <>
            <div className={styles.gridCell}>
              <span className={styles.label}>5M</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]:
                    (pool.priceChangeM5 ? Number(pool.priceChangeM5) : 0) >= 0,
                  [styles.negative]:
                    (pool.priceChangeM5 ? Number(pool.priceChangeM5) : 0) < 0,
                })}
              >
                {formatPercent(
                  pool.priceChangeM5 ? Number(pool.priceChangeM5) : null,
                )}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>1H</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]:
                    (pool.priceChangeH1 ? Number(pool.priceChangeH1) : 0) >= 0,
                  [styles.negative]:
                    (pool.priceChangeH1 ? Number(pool.priceChangeH1) : 0) < 0,
                })}
              >
                {formatPercent(
                  pool.priceChangeH1 ? Number(pool.priceChangeH1) : null,
                )}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>6H</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]:
                    (pool.priceChangeH6 ? Number(pool.priceChangeH6) : 0) >= 0,
                  [styles.negative]:
                    (pool.priceChangeH6 ? Number(pool.priceChangeH6) : 0) < 0,
                })}
              >
                {formatPercent(
                  pool.priceChangeH6 ? Number(pool.priceChangeH6) : null,
                )}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>24H</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]:
                    (pool.priceChangeH24 ? Number(pool.priceChangeH24) : 0) >=
                    0,
                  [styles.negative]:
                    (pool.priceChangeH24 ? Number(pool.priceChangeH24) : 0) < 0,
                })}
              >
                {formatPercent(
                  pool.priceChangeH24 ? Number(pool.priceChangeH24) : null,
                )}
              </span>
            </div>
          </>
        ) : (
          <div className={styles.gridCell}>
            <span className={styles.label}>24H CHANGE</span>
            <span
              className={classNames(styles.valueMedium, {
                [styles.positive]:
                  (data?.priceChangePercentage24h
                    ? Number(data.priceChangePercentage24h)
                    : 0) >= 0,
                [styles.negative]:
                  (data?.priceChangePercentage24h
                    ? Number(data.priceChangePercentage24h)
                    : 0) < 0,
              })}
            >
              {formatPercent(
                data?.priceChangePercentage24h
                  ? Number(data.priceChangePercentage24h)
                  : null,
              )}
            </span>
          </div>
        )}
      </div>

      {/* ROW 4: 24H VOL Breakdown (Label | Buy | Sell | Net) - 4 Cols */}
      {pool && (
        <div className={styles.gridRow}>
          <div className={styles.gridCellLeft}>
            <span className={styles.label}>24H VOL</span>
            <span className={styles.valueMedium}>
              {formatDollarCompact(
                pool.volume24h ? Number(pool.volume24h) : null,
              )}
            </span>
          </div>
          {/* Buy */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>BUY</span>
            <span className={styles.buyColor}>
              {formatDollarCompact(
                pool.buyVolume24h ? Number(pool.buyVolume24h) : null,
              )}
            </span>
          </div>
          {/* Sell */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>SELL</span>
            <span className={styles.sellColor}>
              {formatDollarCompact(
                pool.sellVolume24h ? Number(pool.sellVolume24h) : null,
              )}
            </span>
          </div>
          {/* Net */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>NET</span>
            <span
              className={classNames(styles.valueSmall, {
                [styles.positive]:
                  pool.netBuyVolume24h != null &&
                  Number(pool.netBuyVolume24h) >= 0,
                [styles.negative]:
                  pool.netBuyVolume24h != null &&
                  Number(pool.netBuyVolume24h) < 0,
              })}
            >
              {formatDollarCompact(
                pool.netBuyVolume24h ? Number(pool.netBuyVolume24h) : null,
              )}
            </span>
          </div>
        </div>
      )}

      {/* ROW 5: 24H TXNS Breakdown (Label | Buy | Sell | Net) - 4 Cols */}
      {pool && (
        <div className={styles.gridRow}>
          <div className={styles.gridCellLeft}>
            <span className={styles.label}>24H TXNS</span>
            <span className={styles.valueMedium}>
              {formatNumberCompact(
                pool.buys24h && pool.sells24h
                  ? Number(pool.buys24h) + Number(pool.sells24h)
                  : null,
              )}
            </span>
          </div>
          {/* Buy */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>BUY</span>
            <span className={styles.buyColor}>
              {formatNumberCompact(pool.buys24h ? Number(pool.buys24h) : null)}
            </span>
          </div>
          {/* Sell */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>SELL</span>
            <span className={styles.sellColor}>
              {formatNumberCompact(
                pool.sells24h ? Number(pool.sells24h) : null,
              )}
            </span>
          </div>
          {/* Net */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>NET</span>
            <span
              className={classNames(styles.valueSmall, {
                [styles.positive]:
                  pool.buys24h != null &&
                  pool.sells24h != null &&
                  Number(pool.buys24h) >= Number(pool.sells24h),
                [styles.negative]:
                  pool.buys24h != null &&
                  pool.sells24h != null &&
                  Number(pool.buys24h) < Number(pool.sells24h),
              })}
            >
              {pool.buys24h != null && pool.sells24h != null
                ? formatNumberCompact(
                    Number(pool.buys24h) - Number(pool.sells24h),
                  )
                : "-"}
            </span>
          </div>
        </div>
      )}

      {/* ROW 6: Traders (Full width with space between) */}
      {pool && (
        <div className={classNames(styles.gridRow, styles.singleItemRow)}>
          <span className={styles.label}>24H TRADERS</span>
          <span className={styles.valueLarge}>
            {formatNumberCompact(
              pool.buyers24h && pool.sellers24h
                ? Number(pool.buyers24h) + Number(pool.sellers24h)
                : null,
            )}
          </span>
        </div>
      )}

      {/* ROW 8: Holders */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>TOP 10 HOLDERS</span>
          <span className={styles.valueMedium}>
            {top10HoldersPercent.toFixed(2)}%
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>HOLDERS</span>
          <span className={styles.valueMedium}>
            {holdersInfo?.holdersCount
              ? formatNumberCompact(holdersInfo.holdersCount)
              : "-"}
          </span>
        </div>
      </div>

      {/* ROW 9: Supply & Markets */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>CIRC SUPPLY</span>
          <span className={styles.valueMedium}>
            {formatNumberCompact(
              data?.circulatingSupply ? Number(data.circulatingSupply) : null,
            )}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>TOTAL SUPPLY</span>
          <span className={styles.valueMedium}>
            {formatNumberCompact(
              data?.totalSupply ? Number(data.totalSupply) : null,
            )}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>MARKETS</span>
          <span className={styles.valueMedium}>{marketsCount ?? "-"}</span>
        </div>
      </div>
    </div>
  );
};
