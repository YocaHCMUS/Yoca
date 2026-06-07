import styles from "./AiAnalysisDashboard.module.scss";
import { HelpTooltip } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";
import { truncateMiddle } from "./utils";

export function SignatureChip({ signature }: { signature: string }) {
  const { tr } = useAiAnalysisI18n();
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
      <HelpTooltip text={String(tr("aiAnalysisDashboard.evidence.signatureTooltip"))} />
    </span>
  );
}

export function TokenMintChip({ mint }: { mint: string }) {
  const { tr } = useAiAnalysisI18n();
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
      <HelpTooltip text={String(tr("aiAnalysisDashboard.evidence.tokenMintTooltip"))} />
    </span>
  );
}
