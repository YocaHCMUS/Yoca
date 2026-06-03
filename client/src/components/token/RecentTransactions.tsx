import { useLocalization } from "@/contexts/LocalizationContext";
import {
  BUBBLEMAPS_SOL_URL,
  SOLSCAN_ACCOUNT_URL,
  SOLSCAN_TX_URL,
} from "@/config/constants";
import { Launch } from "@carbon/icons-react";
import { useMemo, useState } from "react";
import styles from "./RecentTransactions.module.scss";

type PoolTrade = {
  id: string;
  kind: "buy" | "sell";
  priceUsd: number;
  priceQuote: number;
  volumeUsd: number;
  amount: number;
  fromAddress: string;
  timestamp: string;
  txHash: string;
};

type TradeFilter = "all" | "buy" | "sell";

interface RecentTransactionsProps {
  trades: PoolTrade[];
  tokenAddress: string;
  tokenSymbol: string;
  baseMeta: {
    address: string;
    symbol: string;
    imageUrl: string | null;
  };
  quoteMeta: {
    address: string;
    symbol: string;
    imageUrl: string | null;
  };
}

export const RecentTransactions = ({
  trades,
  baseMeta,
  quoteMeta,
}: RecentTransactionsProps) => {
  void quoteMeta;
  const [showBubbleMapModal, setShowBubbleMapModal] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TradeFilter>("all");
  const { tr, fmt } = useLocalization();

  const tradeCounts = useMemo(
    () =>
      trades.reduce(
        (counts, trade) => ({
          ...counts,
          [trade.kind]: counts[trade.kind] + 1,
        }),
        { all: trades.length, buy: 0, sell: 0 },
      ),
    [trades],
  );

  const filteredTrades = useMemo(
    () =>
      typeFilter === "all"
        ? trades
        : trades.filter((trade) => trade.kind === typeFilter),
    [trades, typeFilter],
  );

  const filterOptions: Array<{ value: TradeFilter; label: string }> = [
    { value: "all", label: tr("token.recentTransactions.all") },
    { value: "buy", label: tr("token.recentTransactions.buy") },
    { value: "sell", label: tr("token.recentTransactions.sell") },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.tabsHeader}>
        <div className={styles.tabsGroup}>
          <div
            className={`${styles.tab} ${styles.active}`}
            // Always active since it's the main view now
          >
            {tr("token.recentTransactions.transactions")}
          </div>
          <div
            className={styles.tab}
            onClick={() => setShowBubbleMapModal(true)}
          >
            {tr("token.recentTransactions.bubblemaps")}
          </div>
        </div>

        <div className={styles.typeFilters} aria-label="Transaction type">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`${styles.filterButton} ${
                typeFilter === option.value ? styles.filterButtonActive : ""
              } ${
                option.value === "buy"
                  ? styles.buyFilter
                  : option.value === "sell"
                    ? styles.sellFilter
                    : ""
              }`}
              onClick={() => setTypeFilter(option.value)}
            >
              <span>{option.label}</span>
              <span className={styles.filterCount}>
                {tradeCounts[option.value]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{tr("token.recentTransactions.time")}</th>
              <th>{tr("token.recentTransactions.type")}</th>
              <th>{tr("token.recentTransactions.priceUsd")}</th>
              <th>{baseMeta.symbol.toUpperCase()}</th>
              <th>{tr("token.recentTransactions.value")}</th>
              <th>{tr("token.recentTransactions.from")}</th>
              <th>{tr("token.recentTransactions.tx")}</th>
            </tr>
          </thead>
          <tbody>
            {filteredTrades.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>
                  {tr("token.recentTransactions.empty")}
                </td>
              </tr>
            ) : (
              filteredTrades.map((trade) => (
                <tr key={trade.id}>
                  <td>
                    <span className={styles.timeText}>
                      {fmt.datetime.datetime(trade.timestamp)}
                    </span>
                  </td>
                  <td
                    className={`${styles.type} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {trade.kind == "buy"
                      ? tr("token.recentTransactions.buy")
                      : tr("token.recentTransactions.sell")}
                  </td>
                  <td
                    className={`${styles.price} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.currency(trade.priceUsd)}
                  </td>
                  <td
                    className={`${styles.amount} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.unit(
                      trade.amount,
                      baseMeta.symbol.toUpperCase(),
                    )}
                  </td>
                  <td
                    className={`${styles.value} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.currency(trade.volumeUsd)}
                  </td>
                  <td>
                    <a
                      href={`${SOLSCAN_ACCOUNT_URL}/${trade.fromAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.link}
                    >
                      {fmt.text.address(trade.fromAddress)}
                    </a>
                  </td>
                  <td>
                    <a
                      href={`${SOLSCAN_TX_URL}/${trade.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.iconLink}
                    >
                      <Launch size={14} />
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* BubbleMaps Modal */}
      {showBubbleMapModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowBubbleMapModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <h3>{tr("token.recentTransactions.bubblemaps")}</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowBubbleMapModal(false)}
              >
                &times;
              </button>
            </div>
            <div className={styles.bubblemapsContainer}>
              {baseMeta.address ? (
                <iframe
                  src={`${BUBBLEMAPS_SOL_URL}/${baseMeta.address}?theme=light`}
                  title="BubbleMaps"
                  className={styles.bubblemapsIframe}
                />
              ) : (
                <div className={styles.emptyState}>
                  {tr("token.recentTransactions.noAddress")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
