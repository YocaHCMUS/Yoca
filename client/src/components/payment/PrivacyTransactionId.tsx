import { useState, useCallback } from "react";
import { Check, Clipboard, Eye, EyeOff } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";

interface PrivacyTransactionIdProps {
  /** The full, unmasked Solana transaction signature. */
  transactionId: string;
  /** Optional label shown above the ID row. Defaults to "Transaction ID". */
  label?: string;
}

/**
 * Displays a Solana transaction ID with privacy controls.
 *
 * - Default state shows a partially masked representation: `5aFC••••••••bbsp`
 * - Eye-icon button toggles full plaintext visibility
 * - Clipboard-icon button ALWAYS copies the full unmasked ID regardless of
 *   the current visibility state, with a 2-second "Copied ✓" animation.
 */
export function PrivacyTransactionId({
  transactionId,
  label,
}: PrivacyTransactionIdProps) {
  const { tr } = useLocalization();
  const [isVisible, setIsVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const displayLabel = label ?? tr("payment.transactionId.label");

  /** Returns the masked representation: first 4 chars + bullets + last 4 chars */
  const masked = transactionId.length > 12
    ? `${transactionId.slice(0, 4)}••••••••${transactionId.slice(-4)}`
    : transactionId;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(transactionId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in insecure contexts — silent fallback
      console.warn("[PrivacyTransactionId] Clipboard write failed.");
    }
  }, [transactionId]);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {/* Label */}
      <p className="text-xs font-semibold uppercase tracking-widest text-[#64748b]">
        {displayLabel}
      </p>

      {/* ID row */}
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        {/* ID text */}
        <span
          className="flex-1 text-xs font-mono break-all leading-relaxed transition-all duration-200"
          style={{ color: isVisible ? "#e2e8f0" : "#94a3b8" }}
          title={isVisible ? transactionId : tr("payment.transactionId.revealHint")}
          aria-label={
            isVisible
              ? tr("payment.transactionId.visibleAria", { transactionId })
              : tr("payment.transactionId.hiddenAria")
          }
        >
          {isVisible ? transactionId : masked}
        </span>

        {/* Control buttons */}
        <div className="flex items-center gap-1 flex-shrink-0 pl-2 border-l border-white/10">
          {/* Toggle visibility */}
          <button
            id="privacy-txid-toggle-btn"
            type="button"
            onClick={() => setIsVisible((v) => !v)}
            aria-label={
              isVisible
                ? tr("payment.transactionId.hideAria")
                : tr("payment.transactionId.showAria")
            }
            title={
              isVisible
                ? tr("payment.transactionId.hide")
                : tr("payment.transactionId.reveal")
            }
            className="rounded-lg p-1.5 text-[#64748b] transition-all duration-150 hover:bg-[#7C3AED]/10 hover:text-[#7C3AED]"
          >
            {isVisible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>

          {/* Copy to clipboard */}
          <div className="relative">
            <button
              id="privacy-txid-copy-btn"
              type="button"
              onClick={handleCopy}
              aria-label={tr("payment.transactionId.copyAria")}
              title={tr("payment.transactionId.copyTitle")}
              className="p-1.5 rounded-lg transition-all duration-150"
              style={{
                color: isCopied ? "#7C3AED" : "#64748b",
              }}
              onMouseEnter={(e) => {
                if (!isCopied) (e.currentTarget as HTMLButtonElement).style.color = "#7C3AED";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(124,58,237,0.1)";
              }}
              onMouseLeave={(e) => {
                if (!isCopied) (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              {isCopied ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Clipboard className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* "Copied!" tooltip bubble */}
            {isCopied && (
              <span
                className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap pointer-events-none"
                style={{
                  backgroundColor: "#7C3AED",
                  color: "#fff",
                  boxShadow: "0 0 12px rgba(124,58,237,0.4)",
                }}
              >
                {tr("payment.transactionId.copied")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
