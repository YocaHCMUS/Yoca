import { Copy, Star, StarFilled } from "@carbon/icons-react";
import classNames from "classnames";
import { useNavigate } from "react-router";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import styles from "./TraderTable.module.scss";

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
  void type;

  const navigate = useNavigate();
  const { tr, fmt } = useLocalization();
  const { walletWatchlist, walletPending, toggleWallet } = useWatchlist();

  return (
    <div className={styles.traderTableContainer}>
      <table className={styles.traderTable}>
        <thead>
          <tr>
            <th className={styles.thStar} />
            <th className={styles.thTrader}>{tr("marketPage.trader")}</th>
            <th className={styles.thRight}>PnL</th>
            <th className={styles.thRight}>{tr("marketPage.volume")}</th>
            <th className={styles.thRight}>{tr("marketPage.trades")}</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={5} className={styles.emptyCell}>
                {tr("marketPage.loading")}
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={5} className={styles.emptyCell}>
                {tr("marketPage.noDataAvailable")}
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
                  <td className={styles.tdStar}>
                    <button
                      className={classNames(styles.starBtn, {
                        [styles.starBtnActive]: inWatchlist,
                      })}
                      disabled={isPending}
                      onClick={(event) => {
                        event.stopPropagation();
                        void toggleWallet(trader.address);
                      }}
                      title={
                        inWatchlist
                          ? tr("marketPage.removeFromWatchlist")
                          : tr("marketPage.addToWatchlist")
                      }
                    >
                      {inWatchlist ? (
                        <StarFilled size={14} />
                      ) : (
                        <Star size={14} />
                      )}
                    </button>
                  </td>

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
                        onClick={(event) => {
                          event.stopPropagation();
                          navigator.clipboard.writeText(trader.address);
                        }}
                        title={tr("marketPage.copyAddress")}
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </td>

                  <td className={styles.tdRight}>
                    <span className={classNames(styles.numVal, pnlColorClass)}>
                      {pnlValue > 0 ? "+" : ""}
                      {fmt.num.compact.currency(pnlValue)}
                    </span>
                  </td>

                  <td className={styles.tdRight}>
                    <span className={styles.numVal}>
                      {fmt.num.compact.currency(trader.volume)}
                    </span>
                  </td>

                  <td className={styles.tdRight}>
                    <span className={styles.numVal}>
                      {fmt.num.decimal(trader.tradeCount)}
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
