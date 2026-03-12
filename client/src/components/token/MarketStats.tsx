import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { formatChangePercent } from "@/util/format";
import classNames from "classnames";
import type { InferResponseType } from "hono/client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./MarketStats.module.scss";

function Tip({
  tip,
  children,
  className,
}: {
  tip?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  if (!tip) return <span className={className}>{children}</span>;

  return (
    <>
      <span
        ref={ref}
        className={className}
        onMouseEnter={() => {
          if (ref.current) {
            const r = ref.current.getBoundingClientRect();
            setPos({ x: r.left + r.width / 2, y: r.top - 4 });
          }
        }}
        onMouseLeave={() => setPos(null)}
      >
        {children}
      </span>
      {pos && createPortal(
        <div style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          transform: "translate(-50%, -100%)",
          background: "#ffffff",
          color: "#161616",
          fontSize: "12px",
          fontFamily: "Inter, system-ui, sans-serif",
          padding: "3px 8px",
          borderRadius: "2px",
          border: "1px solid #e0e0e0",
          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
          whiteSpace: "nowrap",
          zIndex: 9999,
          pointerEvents: "none",
          lineHeight: "1.5",
        }}>
          {tip}
        </div>,
        document.body,
      )}
    </>
  );
}

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
  const { tr, fmt } = useLocalization();

  const top10HoldersPercent = holdersInfo?.top10Percent
    ? Number(holdersInfo.top10Percent)
    : (topHolders?.reduce((acc, curr) => acc + curr.percentage, 0) ?? 0);

  return (
    <div
      className={classNames(styles.container, {
        [styles.horizontal]: layout == "horizontal",
      })}
    >
      {/* ROW 1: Prices */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.priceUsd")}</span>
          <div className={styles.pricesContainer}>
            <span className={styles.valueLarge}>
              {fmt.num.currency(
                pool?.baseTokenPriceUsd
                  ? Number(pool.baseTokenPriceUsd)
                  : data?.priceUsd
                    ? Number(data.priceUsd)
                    : null,
              )}
            </span>
          </div>
        </div>
        {pool && (
          <div className={styles.gridCell}>
            <span className={styles.label}>
              {pool.poolName
                ? pool.poolName.replace(/\s+\d+(\.\d+)?%$/, "").trim()
                : tr("token.marketStats.priceBaseQuote")}
            </span>
            <div className={styles.pricesContainer}>
              <span className={styles.valueLarge}>
                {pool.baseTokenPriceUsd != null &&
                  pool.quoteTokenPriceUsd != null
                  ? (pool.baseTokenPriceUsd / pool.quoteTokenPriceUsd).toFixed(
                    6,
                  )
                  : "-"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ROW 2: Key Stats */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.liquidity")}</span>
          <Tip
            tip={pool?.liquidityUsd ? fmt.num.currency(Number(pool.liquidityUsd)) : null}
            className={styles.valueMedium}
          >
            {fmt.num.compact.currency(
              pool?.liquidityUsd ? Number(pool.liquidityUsd) : null,
            )}
          </Tip>
        </div>
        <div className={styles.gridCell}>
          <Tip tip={tr("token.marketStats.marketCapTip")} className={styles.label}>
            {tr("token.marketStats.marketCap")}
          </Tip>
          <Tip
            tip={
              pool?.marketCapUsd
                ? fmt.num.currency(Number(pool.marketCapUsd))
                : data?.marketCap
                  ? fmt.num.currency(Number(data.marketCap))
                  : null
            }
            className={styles.valueMedium}
          >
            {fmt.num.compact.currency(
              pool?.marketCapUsd
                ? Number(pool.marketCapUsd)
                : data?.marketCap
                  ? Number(data.marketCap)
                  : null,
            )}
          </Tip>
        </div>
        <div className={styles.gridCell}>
          <Tip tip={tr("token.marketStats.fdvTip")} className={styles.label}>
            {tr("token.marketStats.fdv")}
          </Tip>
          <Tip
            tip={
              pool?.fdvUsd
                ? fmt.num.currency(Number(pool.fdvUsd))
                : data?.fullyDilutedValuation
                  ? fmt.num.currency(Number(data.fullyDilutedValuation))
                  : null
            }
            className={styles.valueMedium}
          >
            {fmt.num.compact.currency(
              pool?.fdvUsd
                ? Number(pool.fdvUsd)
                : data?.fullyDilutedValuation
                  ? Number(data.fullyDilutedValuation)
                  : null,
            )}
          </Tip>
        </div>
      </div>

      {/* ROW 3: Period Changes */}
      <div className={styles.gridRow}>
        {pool ? (
          <>
            <div className={styles.gridCell}>
              <span className={styles.label}>{tr("token.marketStats.change5m")}</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]: (pool.priceChangePercentage5m ?? 0) >= 0,
                  [styles.negative]: (pool.priceChangePercentage5m ?? 0) < 0,
                })}
              >
                {formatChangePercent(pool.priceChangePercentage5m != null ? Number(pool.priceChangePercentage5m) : null)}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>{tr("token.marketStats.change1h")}</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]: (pool.priceChangePercentage1h ?? 0) >= 0,
                  [styles.negative]: (pool.priceChangePercentage1h ?? 0) < 0,
                })}
              >
                {formatChangePercent(pool.priceChangePercentage1h)}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>{tr("token.marketStats.change6h")}</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]: (pool.priceChangePercentage6h || 0) >= 0,
                  [styles.negative]: (pool.priceChangePercentage6h || 0) < 0,
                })}
              >
                {formatChangePercent(pool.priceChangePercentage6h)}
              </span>
            </div>
            <div className={styles.gridCell}>
              <span className={styles.label}>{tr("token.marketStats.change24h")}</span>
              <span
                className={classNames(styles.valueMedium, {
                  [styles.positive]: (pool.priceChangePercentage24h || 0) >= 0,
                  [styles.negative]: (pool.priceChangePercentage24h || 0) < 0,
                })}
              >
                {formatChangePercent(pool.priceChangePercentage24h)}
              </span>
            </div>
          </>
        ) : (
          <div className={styles.gridCell}>
            <span className={styles.label}>{tr("token.marketStats.change24hFull")}</span>
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
              {formatChangePercent(
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
            <Tip tip={tr("token.marketStats.vol24hTip")} className={styles.label}>
              {tr("token.marketStats.vol24h")}
            </Tip>
            <Tip
              tip={pool.volumeUsd24h ? fmt.num.currency(pool.volumeUsd24h) : null}
              className={styles.valueMedium}
            >
              {fmt.num.compact.currency(pool.volumeUsd24h)}
            </Tip>
          </div>
          {/* Buy */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.buy")}</span>
            <Tip
              tip={pool.buyVolumeUsd24h ? fmt.num.currency(pool.buyVolumeUsd24h) : null}
              className={styles.buyColor}
            >
              {fmt.num.compact.currency(pool.buyVolumeUsd24h)}
            </Tip>
          </div>
          {/* Sell */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.sell")}</span>
            <Tip
              tip={pool.sellVolumeUsd24h ? fmt.num.currency(pool.sellVolumeUsd24h) : null}
              className={styles.sellColor}
            >
              {fmt.num.compact.currency(pool.sellVolumeUsd24h)}
            </Tip>
          </div>
          {/* Net */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.net")}</span>
            <Tip
              tip={
                pool.buyVolumeUsd24h != null && pool.sellVolumeUsd24h != null
                  ? fmt.num.currency(Number(pool.buyVolumeUsd24h) - Number(pool.sellVolumeUsd24h))
                  : null
              }
              className={classNames(styles.valueSmall, {
                [styles.positive]:
                  pool.buyVolumeUsd24h != null &&
                  pool.sellVolumeUsd24h != null &&
                  Number(pool.buyVolumeUsd24h) - Number(pool.sellVolumeUsd24h) >= 0,
                [styles.negative]:
                  pool.buyVolumeUsd24h != null &&
                  pool.sellVolumeUsd24h != null &&
                  Number(pool.buyVolumeUsd24h) - Number(pool.sellVolumeUsd24h) < 0,
              })}
            >
              {pool.buyVolumeUsd24h != null && pool.sellVolumeUsd24h != null
                ? fmt.num.compact.currency(
                  Number(pool.buyVolumeUsd24h) - Number(pool.sellVolumeUsd24h),
                )
                : "-"}
            </Tip>
          </div>
        </div>
      )}

      {/* ROW 5: 24H TXNS Breakdown (Label | Buy | Sell | Net) - 4 Cols */}
      {pool && (
        <div className={styles.gridRow}>
          <div className={styles.gridCellLeft}>
            <Tip tip={tr("token.marketStats.txns24hTip")} className={styles.label}>
              {tr("token.marketStats.txns24h")}
            </Tip>
            <Tip
              tip={
                pool.buys24h && pool.sells24h
                  ? fmt.num.decimal(Number(pool.buys24h) + Number(pool.sells24h))
                  : null
              }
              className={styles.valueMedium}
            >
              {fmt.num.compact.decimal(
                pool.buys24h && pool.sells24h
                  ? Number(pool.buys24h) + Number(pool.sells24h)
                  : null,
              )}
            </Tip>
          </div>
          {/* Buy */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.buy")}</span>
            <Tip
              tip={pool.buys24h ? fmt.num.decimal(Number(pool.buys24h)) : null}
              className={styles.buyColor}
            >
              {fmt.num.compact.decimal(pool.buys24h ? Number(pool.buys24h) : null)}
            </Tip>
          </div>
          {/* Sell */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.sell")}</span>
            <Tip
              tip={pool.sells24h ? fmt.num.decimal(Number(pool.sells24h)) : null}
              className={styles.sellColor}
            >
              {fmt.num.compact.decimal(
                pool.sells24h ? Number(pool.sells24h) : null,
              )}
            </Tip>
          </div>
          {/* Net */}
          <div className={styles.gridCellRight}>
            <span className={styles.label}>{tr("token.marketStats.net")}</span>
            <Tip
              tip={
                pool.buys24h != null && pool.sells24h != null
                  ? fmt.num.decimal(Number(pool.buys24h) - Number(pool.sells24h))
                  : null
              }
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
                ? fmt.num.compact.decimal(
                  Number(pool.buys24h) - Number(pool.sells24h),
                )
                : "-"}
            </Tip>
          </div>
        </div>
      )}

      {/* ROW 6: Traders (Full width with space between) */}
      {pool && (
        <div className={classNames(styles.gridRow, styles.singleItemRow)}>
          <span className={styles.label}>{tr("token.marketStats.traders24h")}</span>
          <Tip
            tip={
              pool.buyers24h && pool.sellers24h
                ? fmt.num.decimal(Number(pool.buyers24h) + Number(pool.sellers24h))
                : null
            }
            className={styles.valueLarge}
          >
            {fmt.num.compact.decimal(
              pool.buyers24h && pool.sellers24h
                ? Number(pool.buyers24h) + Number(pool.sellers24h)
                : null,
            )}
          </Tip>
        </div>
      )}

      {/* ROW 8: Holders */}
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.top10Holders")}</span>
          <span className={styles.valueMedium}>
            {top10HoldersPercent.toFixed(2)}%
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.holders")}</span>
          <Tip
            tip={holdersInfo?.holdersCount ? fmt.num.decimal(holdersInfo.holdersCount) : null}
            className={styles.valueMedium}
          >
            {fmt.num.compact.decimal(holdersInfo?.holdersCount ?? null)}
          </Tip>
        </div>
      </div>

      {/* ROW 9: Supply & Markets — temporarily hidden
      <div className={styles.gridRow}>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.circSupply")}</span>
          <span className={styles.valueMedium}>
            {data?.circulatingSupply
              ? Number(data.circulatingSupply).toLocaleString()
              : "-"}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.totalSupply")}</span>
          <span className={styles.valueMedium}>
            {fmt.num.compact.decimal(
              data?.totalSupply ? Number(data.totalSupply) : null,
            )}
          </span>
        </div>
        <div className={styles.gridCell}>
          <span className={styles.label}>{tr("token.marketStats.markets")}</span>
          <span className={styles.valueMedium}>{marketsCount ?? "-"}</span>
        </div>
      </div>
      */}
    </div>
  );
};
