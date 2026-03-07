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

/** Unicode subscript digits 0–9 */
const SUB_DIGITS = ["₀","₁","₂","₃","₄","₅","₆","₇","₈","₉"] as const;

function toSubscript(n: number): string {
  return String(n)
    .split("")
    .map((c) => SUB_DIGITS[+c] ?? c)
    .join("");
}

/**
 * Format a token amount for display.
 * - Normal numbers (≥ 0.001): up to 6 significant figures.
 * - Very small numbers: subscript-zero compact notation.
 *   e.g. 1e-9  → "0.0₇1"  (literal 0.0, then 7 compressed zeros, then digits)
 *        2.5e-7 → "0.0₅25"
 * The full precision value is always available via the `title` attribute.
 */
function formatAmount(amount: number): string {
  if (!isFinite(amount) || isNaN(amount)) return "0";
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs === 0) return "0";

  // Normal range: trim to 6 significant figures.
  // Use 'en-US' explicitly so locale-specific compact suffixes (e.g. Vietnamese
  // "Tr" for million) never appear regardless of the browser/OS locale.
  if (abs >= 0.001) {
    const trimmed = parseFloat(abs.toPrecision(6));
    return sign + trimmed.toLocaleString("en-US", { maximumSignificantDigits: 6 });
  }

  // Very small: subscript-zero notation
  // toFixed(20) gives enough room to count leading zeros without scientific notation
  const raw = abs.toFixed(20);
  const afterDot = raw.split(".")[1] ?? "";
  let zeros = 0;
  for (const ch of afterDot) {
    if (ch === "0") zeros++;
    else break;
  }

  // Significant digits, up to 4, trailing zeros stripped
  const sig = afterDot.slice(zeros).replace(/0+$/, "").slice(0, 4) || "1";

  // Always show "0.0" literally; subscript encodes the (zeros-1) additional
  // compressed zeros that follow, e.g. 1e-9 → 0.0₇1 (not 0.₈1)
  const compressed = zeros - 1;
  return compressed > 0
    ? `${sign}0.0${toSubscript(compressed)}${sig}`
    : `${sign}0.0${sig}`;
}

// ── Props ──────────────────────────────────────────────────────────────────

interface SwapDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  transfers: TransferRecord[] | null;
  fee?: number;
  slot?: number;
  feePayer?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SwapDetailModal({
  isOpen,
  onClose,
  transfers,
  fee,
  slot,
  feePayer,
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
                  {formatAmount(outTransfer.amount)}
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
                  {formatAmount(inTransfer.amount)}
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
              {formatAmount(outTransfer.amount)} {getSymbolOrMint(outTransfer)}
            </strong>{" "}
            for{" "}
            <strong>
              {formatAmount(inTransfer.amount)} {getSymbolOrMint(inTransfer)}
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

          {fee !== undefined && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Transaction Fee</span>
              <span className={styles.detailVal}>{fee.toFixed(9)} SOL</span>
            </div>
          )}

          {slot !== undefined && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Slot</span>
              <span className={styles.detailVal}>{slot.toLocaleString()}</span>
            </div>
          )}

          {feePayer && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Fee Payer</span>
              <span className={styles.detailVal} title={feePayer}>
                {truncateAddr(feePayer)}
              </span>
            </div>
          )}

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

        {/* ── All Balance Changes (for complex swaps with >2 changes) ── */}
        {transfers.length > 2 && (
          <div className={styles.balanceChanges}>
            <h3 className={styles.sectionTitle}>All Balance Changes ({transfers.length})</h3>
            <div className={styles.changesList}>
              {transfers.map((t, idx) => (
                <div key={idx} className={styles.changeItem}>
                  <span className={styles.changeDirection}>
                    {t.direction === "in" ? "+" : "-"}
                  </span>
                  <span className={styles.changeAmount} title={String(t.amount)}>
                    {formatAmount(t.amount)}
                  </span>
                  <span className={styles.changeSymbol} title={t.symbol ?? t.mint}>
                    {getSymbolOrMint(t)}
                  </span>
                  <span className={styles.changeMint} title={t.mint}>
                    {truncateAddr(t.mint)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>,
    modalRoot,
  );
}
