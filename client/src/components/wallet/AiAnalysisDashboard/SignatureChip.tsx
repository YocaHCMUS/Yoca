import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip } from "./HelpTooltip";
import { truncateMiddle } from "./utils";

export function SignatureChip({ signature }: { signature: string }) {
  return (
    <span className={styles.labelWithTooltip}>
      <a
        className={styles.signatureChip}
        href={`https://solscan.io/tx/${signature}`}
        target="_blank"
        rel="noopener noreferrer"
        title={signature}
      >
        {truncateMiddle(signature)}
      </a>
      <HelpTooltip text="Representative transaction used as supporting evidence. Opens in Solscan." />
    </span>
  );
}

export function TokenMintChip({ mint }: { mint: string }) {
  return (
    <span className={styles.labelWithTooltip}>
      <a
        className={styles.tokenChip}
        href={`https://solscan.io/token/${mint}`}
        target="_blank"
        rel="noopener noreferrer"
        title={mint}
      >
        {truncateMiddle(mint)}
      </a>
      <HelpTooltip text="Token address involved in this signal." />
    </span>
  );
}
