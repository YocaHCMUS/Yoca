import { Copy, Star, StarFilled } from "@carbon/icons-react";
import classNames from "classnames";
import { useNavigate } from "react-router";
import Tble from "@/components/Tble";
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

  const headers = [
    { key: "star", header: "", width: "3rem", align: "center" as const },
    { key: "trader", header: tr("marketPage.trader") },
    { key: "pnl", header: "PnL", align: "end" as const },
    { key: "volume", header: tr("marketPage.volume"), align: "end" as const },
    { key: "trades", header: tr("marketPage.trades"), align: "end" as const },
  ];

  const rows = data.map((trader) => {
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

    return {
      id: trader.address,
      star: (
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
          {inWatchlist ? <StarFilled size={14} /> : <Star size={14} />}
        </button>
      ),
      trader: (
        <div className={styles.traderCell}>
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
      ),
      pnl: (
        <span className={classNames(styles.numVal, pnlColorClass)}>
          {pnlValue > 0 ? "+" : ""}
          {fmt.num.compact.currency(pnlValue)}
        </span>
      ),
      volume: (
        <span className={styles.numVal}>
          {fmt.num.compact.currency(trader.volume)}
        </span>
      ),
      trades: (
        <span className={styles.numVal}>
          {fmt.num.decimal(trader.tradeCount)}
        </span>
      ),
    };
  });

  if (data.length === 0 && !loading) {
    return (
      <div className={styles.emptyCell}>
        {tr("marketPage.noDataAvailable")}
      </div>
    );
  }

  return (
    <Tble
      headers={headers}
      rows={rows}
      loading={loading}
      onRowClick={(row) => navigate(`/wallets/${row.id}`)}
    />
  );
}
