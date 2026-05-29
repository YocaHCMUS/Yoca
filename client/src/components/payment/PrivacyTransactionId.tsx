import { useState, useCallback } from "react";

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
  label = "Transaction ID",
}: PrivacyTransactionIdProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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
        {label}
      </p>

      {/* ID row */}
      <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
        {/* ID text */}
        <span
          className="flex-1 text-xs font-mono break-all leading-relaxed transition-all duration-200"
          style={{ color: isVisible ? "#e2e8f0" : "#94a3b8" }}
          title={isVisible ? transactionId : "Click the eye icon to reveal"}
          aria-label={isVisible ? `Transaction ID: ${transactionId}` : "Transaction ID hidden"}
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
            aria-label={isVisible ? "Hide transaction ID" : "Show transaction ID"}
            title={isVisible ? "Hide" : "Reveal"}
            className="p-1.5 rounded-lg text-[#64748b] hover:text-[#14F195] hover:bg-[#14F195]/10 transition-all duration-150"
          >
            {isVisible ? (
              /* Eye-off SVG */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07A3 3 0 019.34 9.34M3 3l18 18"
                />
              </svg>
            ) : (
              /* Eye SVG */
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>

          {/* Copy to clipboard */}
          <div className="relative">
            <button
              id="privacy-txid-copy-btn"
              type="button"
              onClick={handleCopy}
              aria-label="Copy full transaction ID to clipboard"
              title="Copy full ID"
              className="p-1.5 rounded-lg transition-all duration-150"
              style={{
                color: isCopied ? "#14F195" : "#64748b",
              }}
              onMouseEnter={(e) => {
                if (!isCopied) (e.currentTarget as HTMLButtonElement).style.color = "#14F195";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(20,241,149,0.1)";
              }}
              onMouseLeave={(e) => {
                if (!isCopied) (e.currentTarget as HTMLButtonElement).style.color = "#64748b";
                (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent";
              }}
            >
              {isCopied ? (
                /* Check SVG */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                /* Clipboard SVG */
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              )}
            </button>

            {/* "Copied!" tooltip bubble */}
            {isCopied && (
              <span
                className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap pointer-events-none"
                style={{
                  backgroundColor: "#14F195",
                  color: "#0a0a0f",
                  boxShadow: "0 0 12px rgba(20,241,149,0.4)",
                }}
              >
                Copied!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
