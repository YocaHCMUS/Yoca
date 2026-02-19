import { useLocalization } from "@/contexts/LocalizationContext";
import { useState } from "react";
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
  const [showBubbleMapModal, setShowBubbleMapModal] = useState(false);
  const { fmt } = useLocalization();

  const shortenAddress = (addr: string) => {
    if (!addr) return "";
    return addr.slice(0, 10);
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabsHeader}>
        <div
          className={`${styles.tab} ${styles.active}`}
          // Always active since it's the main view now
        >
          Transactions
        </div>
        <div className={styles.tab} onClick={() => setShowBubbleMapModal(true)}>
          Bubblemaps
        </div>
      </div>

      <div className={styles.content}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Price {quoteMeta.symbol}</th>
              <th>Price USD</th>
              <th>Value</th>
              <th>From</th>
              <th>TX</th>
            </tr>
          </thead>
          <tbody>
            {trades.length == 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>
                  Loading trades...
                </td>
              </tr>
            ) : trades.length == 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>
                  No recent transactions
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id}>
                  <td className={styles.timeCell}>
                    <span className={styles.timeText}>
                      {fmt.datetime.datetime(trade.timestamp)}
                    </span>
                  </td>
                  <td
                    className={`${styles.type} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {trade.kind.toUpperCase()}
                  </td>
                  <td
                    className={`${styles.price} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.unit(trade.priceQuote, quoteMeta.symbol)}
                  </td>
                  <td
                    className={`${styles.price} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.currency(trade.priceUsd)}
                  </td>
                  <td
                    className={`${styles.amount} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.unit(trade.amount, baseMeta.symbol)}
                  </td>
                  <td
                    className={`${styles.value} ${trade.kind == "buy" ? styles.buy : styles.sell}`}
                  >
                    {fmt.num.compact.currency(trade.volumeUsd)}
                  </td>
                  <td>
                    <a
                      href={`https://solscan.io/account/${trade.fromAddress}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.link}
                    >
                      {shortenAddress(trade.fromAddress)}
                    </a>
                  </td>
                  <td>
                    <a
                      href={`https://solscan.io/tx/${trade.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.iconLink}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
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
              <h3>Bubble Maps</h3>
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
                  src={`https://app.bubblemaps.io/sol/token/${baseMeta.address}?theme=light`}
                  title="BubbleMaps"
                  className={styles.bubblemapsIframe}
                />
              ) : (
                <div className={styles.emptyState}>
                  No token address for bubblemaps
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
