import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchTxDetail,
  fetchTxInstructions,
  type WalletDaySwapSummary,
  type WalletTxDetail,
  type WalletTxInstructionDetail,
} from "@/services/wallet/walletApi";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import { Loading } from "@carbon/react";
import React, { useState } from "react";
import styles from "./TxRow.module.scss";

interface TxRowProps {
  walletAddress: string;
  swap: WalletDaySwapSummary;
}

export const TxRow: React.FC<TxRowProps> = ({ walletAddress, swap }) => {
  const { fmt } = useLocalization();
  const [expanded, setExpanded] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [detail, setDetail] = useState<WalletTxDetail | null>(null);
  const [instructions, setInstructions] = useState<WalletTxInstructionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingInstructions, setLoadingInstructions] = useState(false);

  const timeStr = new Date(swap.timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleExpand = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }

    if (!detail) {
      setLoading(true);
      try {
        const data = await fetchTxDetail(walletAddress, swap.transactionHash);
        setDetail(data);
      } catch {
        setDetail(null);
      } finally {
        setLoading(false);
      }
    }
    setExpanded(true);
  };

  const handleLoadInstructions = async () => {
    if (showInstructions) {
      setShowInstructions(false);
      return;
    }

    if (!instructions) {
      setLoadingInstructions(true);
      try {
        const data = await fetchTxInstructions(walletAddress, swap.transactionHash);
        setInstructions(data);
      } catch {
        setInstructions(null);
      } finally {
        setLoadingInstructions(false);
      }
    }
    setShowInstructions(true);
  };

  return (
    <div className={styles.txRow}>
      <div className={styles.txHeader} onClick={handleExpand}>
        <span className={styles.txTime}>{timeStr}</span>
        <span className={styles.txPair}>{swap.pair}</span>
        <span className={styles.txValue}>{fmt.num.currency(swap.valueUsd)}</span>
        {loading ? (
          <Loading withOverlay={false} small className={styles.spinner} />
        ) : (
          expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />
        )}
      </div>

      {expanded && detail && (
        <div className={styles.txDetail}>
          <div className={styles.detailSection}>
            <h4 className={styles.detailTitle}>Transfers</h4>
            <div className={styles.transferList}>
              {detail.transfers.map((t, i) => {
                const isOut = t.from === walletAddress;
                return (
                  <div key={i} className={styles.transferItem}>
                    <span className={styles.transferDir}>{isOut ? "→" : "←"}</span>
                    <span className={styles.transferAmount}>
                      {isOut ? "-" : "+"}{new Intl.NumberFormat(undefined, { maximumFractionDigits: 6 }).format(t.amount)}
                    </span>
                    <span className={styles.transferSymbol}>{t.symbol ?? t.mint.slice(0, 8)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.detailSection}>
            <h4 className={styles.detailTitle}>Fee</h4>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>Paid</span>
              <span className={styles.feeValue}>{(detail.feePaid / 1e9).toFixed(6)} SOL</span>
            </div>
            <div className={styles.feeRow}>
              <span className={styles.feeLabel}>Payer</span>
              <span className={styles.feeValue}>{detail.feePayer.slice(0, 8)}...{detail.feePayer.slice(-4)}</span>
            </div>
            {detail.feeReceivers.length > 0 && (
              <div className={styles.feeRow}>
                <span className={styles.feeLabel}>Receivers</span>
                <span className={styles.feeValue}>
                  {detail.feeReceivers
                    .filter((r) => r.label)
                    .map((r) => r.label)
                    .join(", ") || detail.feeReceivers.map((r) => r.address.slice(0, 6)).join(", ")}
                </span>
              </div>
            )}
          </div>

          <button className={styles.instructionsBtn} onClick={handleLoadInstructions}>
            {showInstructions ? "Hide" : "View"} Instructions
            {loadingInstructions && <Loading withOverlay={false} small className={styles.btnSpinner} />}
          </button>

          {showInstructions && instructions && (
            <div className={styles.instructionsSection}>
              <h4 className={styles.detailTitle}>Instructions ({instructions.instructions.length})</h4>
              <div className={styles.instructionsList}>
                {instructions.instructions.map((ins) => (
                  <div key={ins.index} className={styles.instructionItem}>
                    <span className={styles.instructionIndex}>#{ins.index}</span>
                    <span className={styles.instructionProgram}>
                      {ins.programLabel || ins.programId.slice(0, 8)}...
                    </span>
                    <span className={styles.instructionAccounts}>
                      {ins.accounts.length} account{ins.accounts.length !== 1 ? "s" : ""}
                    </span>
                    {ins.innerInstructions.length > 0 && (
                      <div className={styles.innerInstructions}>
                        {ins.innerInstructions.map((inner) => (
                          <div key={inner.index} className={styles.innerItem}>
                            <span className={styles.innerIndex}>#{ins.index}.{inner.index}</span>
                            <span className={styles.innerProgram}>
                              {inner.programLabel || inner.programId.slice(0, 8)}...
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
