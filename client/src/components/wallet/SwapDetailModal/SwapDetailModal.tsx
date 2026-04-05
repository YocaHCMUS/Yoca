import { useEffect } from "react";
import ReactDOM from "react-dom";
import { ArrowRight, Close } from "@carbon/react/icons";
import { ID_MODAL_ROOT } from "@/config/constants";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import type { WalletSwap, WalletSwapBalanceChange } from "@/services/wallet/walletApi";
import styles from "./SwapDetailModal.module.scss";

// ── Helpers ────────────────────────────────────────────────────────────────

function getSymbolOrMint(change: WalletSwapBalanceChange | null): string {
  if (!change) return "—";
  const symbol = (change.symbol ?? "").trim();
  if (symbol.length > 0) {
    return symbol.toUpperCase();
  }

  if (!change.mint) {
    return "UNKNOWN";
  }

  return change.mint.slice(0, 8);
}

function getTokenImageUrl(change: WalletSwapBalanceChange | null): string | undefined {
  if (!change) {
    return undefined;
  }

  const logoUri = (change.logoUri ?? "").trim();
  return logoUri.length > 0 ? logoUri : undefined;
}

function getTokenName(change: WalletSwapBalanceChange | null): string | undefined {
  if (!change) {
    return undefined;
  }

  const tokenName = (change.name ?? "").trim();
  return tokenName.length > 0 ? tokenName : undefined;
}

function truncateSig(sig: string): string {
  if (!sig || sig.length <= 8) return sig;
  return `${sig.slice(0, 4)}...${sig.slice(-4)}`;
}

function truncateAddr(addr: string): string {
  if (!addr || addr.length <= 8) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function formatTimestamp(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return isoTimestamp;
  }

  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Unicode subscript digits 0–9 */
const SUB_DIGITS = ["₀", "₁", "₂", "₃", "₄", "₅", "₆", "₇", "₈", "₉"] as const;

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

// function resolveSwapLegs(swap: WalletSwap): {
//   sold: WalletSwapBalanceChange | null;
//   bought: WalletSwapBalanceChange | null;
// } {
//   const soldFromChanges = swap.sold.amount;
//   // swap.balanceChanges.find((change) => change.amount < 0) ?? null;
//   const boughtFromChanges = swap.bought.amount;
//   // swap.balanceChanges.find((change) => change.amount > 0) ?? null;

//   return {
//     sold: soldFromChanges,
//     bought: boughtFromChanges,
//     // sold: swap.sold ?? soldFromChanges,
//     // bought: swap.bought ?? boughtFromChanges,
//   };
// }

function formatFeeLabel(swap: WalletSwap): string {
  if (!swap.baseQuotePrice || !Number.isFinite(swap.baseQuotePrice)) {
    return "—";
  }

  return `${swap.baseQuotePrice * 10 ** (-9)} SOL`;
}

// function formatPairLabel(swap: WalletSwap): string {
//   const pairName = swap.pair?.label?.trim();
//   if (pairName) {
//     return pairName;
//   }

//   const pairAddress = swap.pair?.address ?? "";
//   if (pairAddress.length === 0) {
//     return "—";
//   }

//   return truncateAddr(pairAddress);
// }

// ── Props ──────────────────────────────────────────────────────────────────

interface SwapDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  swap: WalletSwap | null;
}

// ── Component ──────────────────────────────────────────────────────────────

export function SwapDetailModal({
  isOpen,
  onClose,
  swap,
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

  if (!isOpen || !swap) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  // const { sold: outTransfer, bought: inTransfer } = resolveSwapLegs(swap);
  // const allChanges = swap.balanceChanges ?? [];

  const signature = swap.transactionHash;
  const timestamp = swap.blockTimestampIso;

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
            {swap.sold ? (
              <>
                <span className={styles.tokenAmt} title={String(swap.sold.amount)}>
                  {formatAmount(Math.abs(swap.sold.amount))}
                </span>
                <span className={styles.tokenIdentity} title={swap.sold.symbol ?? swap.sold.address}>
                  <TokenIdentityCell
                    symbol={swap.sold.symbol ?? swap.sold.address}
                    fullName={swap.sold.name ?? swap.sold.address}
                    imageUrl={swap.sold.logoUri ?? undefined}
                    imageSize={18}
                    showInitialsFallback
                    tooltipAlign="right"
                  />
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
            {swap.bought ? (
              <>
                <span className={styles.tokenAmt} title={String(swap.bought.amount)}>
                  {formatAmount(Math.abs(swap.bought.amount))}
                </span>
                <span className={styles.tokenIdentity} title={swap.bought.symbol ?? swap.bought.address}>
                  <TokenIdentityCell
                    symbol={swap.bought.symbol ?? swap.bought.address}
                    fullName={swap.bought.name ?? swap.bought.address}
                    imageUrl={swap.bought.logoUri ?? undefined}
                    imageSize={18}
                    showInitialsFallback
                    tooltipAlign="right"
                  />
                </span>
              </>
            ) : (
              <span className={styles.tokenAmt}>—</span>
            )}
          </div>
        </div>

        {/* ── Plain-English summary ── */}
        {swap.sold && swap.bought && (
          <p className={styles.summary}>
            Swapped{" "}
            <strong>
              {formatAmount(Math.abs(swap.sold.amount))} {swap.sold.symbol ?? "UNKNOWN"}
            </strong>{" "}
            for{" "}
            <strong>
              {formatAmount(Math.abs(swap.bought.amount))} {swap.bought.symbol ?? "UNKNOWN"}
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

          {swap.transactionType && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Type</span>
              <span className={styles.detailVal}>{swap.transactionType}</span>
            </div>
          )}

          {swap.exchangeName && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Exchange</span>
              <span className={styles.detailVal}>{swap.exchangeName}</span>
            </div>
          )}


          {swap.tokensInvolved && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Pair</span>
              <span className={styles.detailVal} title={swap.tokensInvolved ?? undefined}>
                {/* {formatPairLabel(swap)} */}
                {swap.tokensInvolved}
              </span>
            </div>
          )}

          {swap.totalValueUsd != null && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Total Value</span>
              <span className={styles.detailVal}>${swap.totalValueUsd.toFixed(4)}</span>
            </div>
          )}

          {swap.baseQuotePrice != null && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Base/Quote Price</span>
              <span className={styles.detailVal}>{swap.baseQuotePrice}</span>
            </div>
          )}

          {Number.isFinite(swap.baseQuotePrice) && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Transaction Fee</span>
              <span className={styles.detailVal}>{formatFeeLabel(swap)}</span>
            </div>
          )}

          {/* {swap.blockNumber != null && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Block Number</span>
              <span className={styles.detailVal}>{swap.blockNumber.toLocaleString()}</span>
            </div>
          )} */}
          {/* 
          {swap.slot !== undefined && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Slot</span>
              <span className={styles.detailVal}>{swap.slot.toLocaleString()}</span>
            </div>
          )} */}

          {/* {swap.feePayer && (
            <div className={styles.detailRow}>
              <span className={styles.detailKey}>Fee Payer</span>
              <span className={styles.detailVal} title={swap.feePayer}>
                {truncateAddr(swap.feePayer)}
              </span>
            </div>
          )} */}
        </div>

        {/* ── All Balance Changes (for complex swaps with >2 changes) ── */}
        {/* {allChanges.length > 2 && (
          <div className={styles.balanceChanges}>
            <h3 className={styles.sectionTitle}>All Balance Changes ({allChanges.length})</h3>
            <div className={styles.changesList}>
              {allChanges.map((change, idx) => (
                <div key={idx} className={styles.changeItem}>
                  <span className={styles.changeDirection}>
                    {change.amount >= 0 ? "+" : "-"}
                  </span>
                  <span className={styles.changeAmount} title={String(change.amount)}>
                    {formatAmount(Math.abs(change.amount))}
                  </span>
                  <span className={styles.changeTokenIdentity} title={change.symbol ?? change.mint}>
                    <TokenIdentityCell
                      symbol={getSymbolOrMint(change)}
                      fullName={getTokenName(change)}
                      imageUrl={getTokenImageUrl(change)}
                      imageSize={16}
                      showInitialsFallback
                      tooltipAlign="right"
                    />
                  </span>
                  <span className={styles.changeMint} title={change.mint}>
                    {truncateAddr(change.mint)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )} */}
      </div>
    </div>,
    modalRoot,
  );
}
