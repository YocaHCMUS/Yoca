import React from "react";
import classNames from "classnames";
import styles from "./TraderTable.module.scss";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useNavigate } from "react-router";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { Star, StarFilled, Copy } from "@carbon/icons-react";

export interface TraderRow {
  rank: number;
  address: string;
  pnl: number;
  volume: number;
  tradeCount: number;
}

interface TraderTableProps {
  data: TraderRow[];
  type: "gainers" | "losers";
  loading?: boolean;
}

function truncateAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function TraderTable({ data, type, loading }: TraderTableProps) {
  const navigate = useNavigate();
  const { fmt } = useLocalization();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();

  return (
    <div className={styles.traderTableContainer}>
      <table className={styles.traderTable}>
        <thead>
          <tr>
            {/* Star column */}
            <th className={styles.thStar} />
            <th className={styles.thTrader}>Trader</th>
            <th className={styles.thRight}>PnL</th>
            <th className={styles.thRight}>Volume</th>
            <th className={styles.thRight}>Trades</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className={styles.emptyCell}>
                Loading…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.emptyCell}>
                No data available
              </td>
            </tr>
          ) : (
            data.map((trader) => {
              const pnlValue = trader.pnl;
              const isPositive = pnlValue > 0;
              const isNegative = pnlValue < 0;
              const pnlColorClass = isPositive
                ? styles.positive
                : isNegative
                ? styles.negative
                : styles.neutral;

              const inWatchlist = walletWatchlist.includes(trader.address);
              const isPending = Boolean(walletPending[trader.address]);

              return (
                <tr key={trader.address}>
                  {/* Watchlist star */}
                  <td className={styles.tdStar}>
                    <button
                      className={classNames(styles.starBtn, {
                        [styles.starBtnActive]: inWatchlist,
                      })}
                      disabled={isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleWallet(trader.address);
                      }}
                      title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
                    >
                      {inWatchlist ? (
                        <StarFilled size={14} />
                      ) : (
                        <Star size={14} />
                      )}
                    </button>
                  </td>

                  {/* Trader address + rank */}
                  <td className={styles.tdTrader}>
                    <div
                      className={styles.traderCell}
                      onClick={() => navigate(`/wallets/${trader.address}`)}
                    >
                      <span className={styles.rank}>#{trader.rank}</span>
                      <span className={styles.walletAddress}>
                        {truncateAddress(trader.address)}
                      </span>
                      <button
                        className={styles.copyBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(trader.address);
                        }}
                        title="Copy address"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>

                  {/* PnL */}
                  <td className={styles.tdRight}>
                    <span className={classNames(styles.numVal, pnlColorClass)}>
                      {pnlValue > 0 ? "+" : ""}
                      {fmt.num.compact.currency(pnlValue)}
                    </span>
                  </td>

                  {/* Volume */}
                  <td className={styles.tdRight}>
                    <span className={styles.numVal}>
                      {fmt.num.compact.currency(trader.volume)}
                    </span>
                  </td>

                  {/* Trades */}
                  <td className={styles.tdRight}>
                    <span className={styles.numVal}>
                      {trader.tradeCount.toLocaleString()}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
