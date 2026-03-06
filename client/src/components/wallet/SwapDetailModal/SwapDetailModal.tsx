import { useEffect } from "react";
import ReactDOM from "react-dom";
import { ArrowRight, Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import styles from "./SwapDetailModal.module.scss";

// ── Interface ──────────────────────────────────────────────────────────────

export interface TransferRecord {
  /** Transaction signature / hash */
  signature: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Whether tokens left ("out") or entered ("in") the wallet */
  direction: "in" | "out";
  /** The other party's wallet address */
  counterparty: string;
  /** SPL token mint address */
  mint: string;
  /** Token ticker symbol, null when unavailable */
  symbol: string | null;
  /** Human-readable amount (already divided by decimals) */
  amount: number;
  /** Raw on-chain amount as string */
  amountRaw: string;
  /** Token decimal places */
  decimals: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSymbolOrMint(t: TransferRecord): string {
  return t.symbol ?? t.mint.slice(0, 8);
}

function truncateSig(sig: string): string {
  if (!sig || sig.length <= 8) return sig;
  return `${sig.slice(0, 4)}...${sig.slice(-4)}`;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SwapDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfers: TransferRecord[] | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SwapDetailModal({
  isOpen,
  onClose,
  transfers,
}: SwapDetailModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !transfers || transfers.length === 0) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  const outTransfer = transfers.find((t) => t.direction === "out") ?? null;
  const inTransfer = transfers.find((t) => t.direction === "in") ?? null;

  const signature = transfers[0].signature;
  const timestamp = transfers[0].timestamp;

  return ReactDOM.createPortal(
    // Backdrop – clicking it closes the modal
    <div
      className={styles.backdrop}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Swap details"
    >
      {/* Card – clicking inside does NOT close the modal */}
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <span className={styles.title}>Swap Details</span>
          <button
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close"
          >
            <Close size={20} />
          </button>
        </div>

        {/* ── Swap visual: [Sold token] → [Bought token] ── */}
        <div className={styles.swapRow}>
          <div className={styles.tokenCard}>
            <span className={styles.dirLabel}>Sold</span>
            {outTransfer ? (
              <>
                <span className={styles.tokenAmt} title={String(outTransfer.amount)}>
                  {outTransfer.amount}
                </span>
                <span className={styles.tokenSym} title={outTransfer.symbol ?? outTransfer.mint}>
                  {getSymbolOrMint(outTransfer)}
                </span>
              </>
            ) : (
              <span className={styles.tokenAmt}>—</span>
            )}
          </div>

          <div className={styles.arrow}>
            <ArrowRight size={28} />
          </div>

          <div className={styles.tokenCard}>
            <span className={styles.dirLabel}>Bought</span>
            {inTransfer ? (
              <>
                <span className={styles.tokenAmt} title={String(inTransfer.amount)}>
                  {inTransfer.amount}
                </span>
                <span className={styles.tokenSym} title={inTransfer.symbol ?? inTransfer.mint}>
                  {getSymbolOrMint(inTransfer)}
                </span>
              </>
            ) : (
              <span className={styles.tokenAmt}>—</span>
            )}
          </div>
        </div>

        {/* ── Plain-English summary ── */}
        {outTransfer && inTransfer && (
          <p className={styles.summary}>
            Swapped{" "}
            <strong>
              {outTransfer.amount} {getSymbolOrMint(outTransfer)}
            </strong>{" "}
            for{" "}
            <strong>
              {inTransfer.amount} {getSymbolOrMint(inTransfer)}
            </strong>
          </p>
        )}

        {/* ── Detail rows ── */}
        <div className={styles.details}>
          <div className={styles.detailRow}>
            <span className={styles.detailKey}>Signature</span>
            <a
              className={styles.detailLink}
              href={`https://solscan.io/tx/${signature}`}
              target="_blank"
              rel="noopener noreferrer"
              title={signature}
            >
              {truncateSig(signature)}
            </a>
          </div>

          <div className={styles.detailRow}>
            <span className={styles.detailKey}>Time</span>
            <span className={styles.detailVal}>{formatTimestamp(timestamp)}</span>
          </div>

          {outTransfer && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Sent to</span>
              <span
                className={styles.detailVal}
                title={outTransfer.counterparty}
              >
                {truncateAddr(outTransfer.counterparty)}
              </span>
            </div>
          )}

          {inTransfer && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Received from</span>
              <span
                className={styles.detailVal}
                title={inTransfer.counterparty}
              >
                {truncateAddr(inTransfer.counterparty)}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>,
    modalRoot,
  );
}
