import { useLocalization } from "@/contexts/LocalizationContext";
import {
  BUBBLEMAPS_SOL_URL,
  SOLSCAN_TX_URL,
} from "@/config/constants";
import { Launch } from "@carbon/icons-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { TblePagination } from "@/components/TblePagination";
import styles from "./RecentTransactions.module.scss";

const DEFAULT_PAGE_SIZE = 12;

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

type FilterKind = "all" | "buy" | "sell";

export const RecentTransactions = ({
  trades,
  baseMeta,
  quoteMeta,
}: RecentTransactionsProps) => {
  void quoteMeta;
  const [showBubbleMapModal, setShowBubbleMapModal] = useState(false);
  const [filter, setFilter] = useState<FilterKind>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const { tr, fmt } = useLocalization();

  // Reset page when filter changes
  const handleFilterChange = (f: FilterKind) => {
    setFilter(f);
    setPage(1);
  };

  const filteredTrades = useMemo(() => {
    if (filter === "all") return trades;
    return trades.filter((t) => t.kind === filter);
  }, [trades, filter]);

  const pagedTrades = filteredTrades.slice(
    (page - 1) * pageSize,
    page * pageSize,
  );

  const buyCount = trades.filter((t) => t.kind === "buy").length;
  const sellCount = trades.filter((t) => t.kind === "sell").length;

  return (
    <div className={styles.container}>
      <div className={styles.tabsHeader}>
        <div
          className={`${styles.tab} ${styles.active}`}
        >
          {tr("token.recentTransactions.transactions")}
        </div>
        <div className={styles.tab} onClick={() => setShowBubbleMapModal(true)}>
          {tr("token.recentTransactions.bubblemaps")}
        </div>

        {/* Spacer */}
        <div className={styles.headerSpacer} />

        {/* Buy/Sell filter buttons */}
        <div className={styles.filterGroup}>
          <button
            className={`${styles.filterBtn} ${filter === "all" ? styles.filterAll : ""}`}
            onClick={() => handleFilterChange("all")}
          >
            {(tr("token.recentTransactions.all") || "LATEST").toUpperCase()}
            <span className={styles.filterCount}>{trades.length}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${styles.filterBuyBtn} ${filter === "buy" ? styles.filterBuyActive : ""}`}
            onClick={() => handleFilterChange("buy")}
          >
            {(tr("token.recentTransactions.buy") || "BUY").toUpperCase()}
            <span className={`${styles.filterCount} ${styles.filterCountBuy}`}>{buyCount}</span>
          </button>
          <button
            className={`${styles.filterBtn} ${styles.filterSellBtn} ${filter === "sell" ? styles.filterSellActive : ""}`}
            onClick={() => handleFilterChange("sell")}
          >
            {(tr("token.recentTransactions.sell") || "SELL").toUpperCase()}
            <span className={`${styles.filterCount} ${styles.filterCountSell}`}>{sellCount}</span>
          </button>
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
            {pagedTrades.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>
                  {tr("token.recentTransactions.empty")}
                </td>
              </tr>
            ) : (
              pagedTrades.map((trade) => (
                <tr key={trade.id} className={trade.kind === "buy" ? styles.rowBuy : styles.rowSell}>
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
                    <Link
                      to={`/wallets/${trade.fromAddress}`}
                      className={styles.link}
                    >
                      {fmt.text.address(trade.fromAddress)}
                    </Link>
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

      {/* Pagination */}
      {filteredTrades.length > pageSize && (
        <div className={styles.paginationContainer}>
          <TblePagination
            page={page}
            pageSize={pageSize}
            pageSizes={[12, 24, 48]}
            totalItems={filteredTrades.length}
            onPageChange={setPage}
            onPageSizeChange={(nextPageSize) => {
              setPageSize(nextPageSize);
              setPage(1);
            }}
          />
        </div>
      )}

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
