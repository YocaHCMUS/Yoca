import styles from "../index.module.scss";

type TransactionOverviewPanelProps = {
  txHash: string;
  txSigner: string;
  txTimeText: string;
  txStatus: "Success" | "Failed";
  txFeeText: string;
  txSummaryText: string;
};

export function TransactionOverviewPanel({
  txHash,
  txSigner,
  txTimeText,
  txStatus,
  txFeeText,
  txSummaryText,
}: TransactionOverviewPanelProps) {
  return (
    <div className={styles.metaPanel}>
      <div className={styles.metaHeader}>Transaction Overview</div>

      <div className={styles.metaRow}>
        <span className={styles.metaKey}>Signature</span>
        <span className={styles.metaValueMono}>{txHash}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaKey}>Signer</span>
        <span className={styles.metaValueMono}>{txSigner || "Unknown"}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaKey}>Time</span>
        <span className={styles.metaValue}>{txTimeText}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaKey}>Fee</span>
        <span className={styles.metaValue}>{txFeeText}</span>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaKey}>Result</span>
        <div className={styles.metaStatusWrap}>
          <span
            className={styles.statusBadge}
            style={{
              color: txStatus === "Success" ? "#166534" : "#991b1b",
              background: txStatus === "Success" ? "#dcfce7" : "#fee2e2",
              borderColor: txStatus === "Success" ? "#86efac" : "#fecaca",
            }}
          >
            {txStatus}
          </span>
          <span className={styles.finalizedText}>finalized (MAX confirmations)</span>
        </div>
      </div>

      <div className={styles.summaryBlock}>
        <div className={styles.summaryLabel}>Summary</div>
        <div className={styles.summaryText}>{txSummaryText}</div>
      </div>
    </div>
  );
}
