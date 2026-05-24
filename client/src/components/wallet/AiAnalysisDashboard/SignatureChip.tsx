import styles from "./AiAnalysisDashboard.module.scss";
import { truncateMiddle } from "./utils";

export function SignatureChip({ signature }: { signature: string }) {
  return (
    <a
      className={styles.signatureChip}
      href={`https://solscan.io/tx/${signature}`}
      target="_blank"
      rel="noopener noreferrer"
      title={signature}
    >
      {truncateMiddle(signature)}
    </a>
  );
}

export function TokenMintChip({ mint }: { mint: string }) {
  return (
    <a
      className={styles.tokenChip}
      href={`https://solscan.io/token/${mint}`}
      target="_blank"
      rel="noopener noreferrer"
      title={mint}
    >
      {truncateMiddle(mint)}
    </a>
  );
}
