import { useState } from "react";
import styles from "./RecentTransactions.module.scss";

type PoolTrade = {
  id: string;
  kind: "buy" | "sell";
  priceUsd: string;
  priceQuote: string;
  volumeUsd: string;
  amount: string;
  fromAddress: string;
  timestamp: string;
  txHash: string;
};

interface RecentTransactionsProps {
  trades: PoolTrade[];
  baseTokenSymbol?: string;
  tokenAddress?: string;
  tokenSymbol?: string;
  poolAddress?: string;
}

export const RecentTransactions = ({
  trades,
  baseTokenSymbol,
  tokenAddress,
  tokenSymbol,
  poolAddress,
}: RecentTransactionsProps) => {
  const [showBubbleMapModal, setShowBubbleMapModal] = useState(false);

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString("en-US", {
      hour12: true,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date
      .toLocaleDateString("en-US", { month: "short", day: "2-digit" })
      .toUpperCase();
  };

  const formatPrice = (price: string) => {
    const p = parseFloat(price);
    if (isNaN(p)) return "0";
    if (p < 0.000001) return p.toExponential(4);
    return p.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    });
  };

  const formatAmount = (amount: string) => {
    const a = parseFloat(amount);
    if (isNaN(a)) return "0";
    return a.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };

  const formatValue = (value: string) => {
    const v = parseFloat(value);
    if (isNaN(v)) return "$0.00";
    return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

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
              <th>Price {(baseTokenSymbol || "SOL").toUpperCase()}</th>
              <th>Price USD</th>
              <th>{(tokenSymbol || "Token").toUpperCase()}</th>
              <th>Value</th>
              <th>From</th>
              <th>TX</th>
            </tr>
          </thead>
          <tbody>
            {trades.length == 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  Loading trades...
                </td>
              </tr>
            ) : trades.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyState}>
                  No recent transactions
                </td>
              </tr>
            ) : (
              trades.map((trade) => (
                <tr key={trade.id}>
                  <td className={styles.timeCell}>
                    <span className={styles.dateBadge}>
                      {formatDate(trade.timestamp)}
                    </span>
                    <span className={styles.timeText}>
                      {formatTime(trade.timestamp)}
                    </span>
                  </td>
                  <td
                    className={`${styles.type} ${trade.kind === "buy" ? styles.buy : styles.sell}`}
                  >
                    {trade.kind.toUpperCase()}
                  </td>
                  <td
                    className={`${styles.price} ${trade.kind === "buy" ? styles.buy : styles.sell}`}
                  >
                    {formatPrice(trade.priceQuote)}
                  </td>
                  <td
                    className={`${styles.price} ${trade.kind === "buy" ? styles.buy : styles.sell}`}
                  >
                    ${formatPrice(trade.priceUsd)}
                  </td>
                  <td
                    className={`${styles.amount} ${trade.kind === "buy" ? styles.buy : styles.sell}`}
                  >
                    {formatAmount(trade.amount)}
                  </td>
                  <td
                    className={`${styles.value} ${trade.kind === "buy" ? styles.buy : styles.sell}`}
                  >
                    {formatValue(trade.volumeUsd)}
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
              {tokenAddress ? (
                <iframe
                  src={`https://app.bubblemaps.io/sol/token/${tokenAddress}?theme=light`}
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
