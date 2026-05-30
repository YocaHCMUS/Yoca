import styles from "./AiAnalysisDashboard.module.scss";
import { ExplanationDetails } from "./HelpTooltip";

export function HowToReadAnalysis() {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>How to Read This Analysis</h3>
          <p className={styles.sectionDescription}>A compact guide to the labels, scores, and evidence.</p>
        </div>
      </div>
      <ExplanationDetails summary="Open explanation">
        <div className={styles.explanationGrid}>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Persona vs Risk</div>
            <p className={styles.inlineHelpText}>
              Persona describes observed behavior. Risk Level describes the total strength of risk signals.
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Scores</div>
            <p className={styles.inlineHelpText}>
              Trust Score is 100 minus Risk Score. Scores are based only on the analyzed transaction window.
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Evidence</div>
            <p className={styles.inlineHelpText}>
              Evidence signatures are representative examples users can verify on Solscan.
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>Limitations</div>
            <p className={styles.inlineHelpText}>
              This is not financial advice or proof of suspicious behavior. Missing or unsupported transactions can reduce reliability.
            </p>
          </div>
        </div>
      </ExplanationDetails>
    </section>
  );
}
