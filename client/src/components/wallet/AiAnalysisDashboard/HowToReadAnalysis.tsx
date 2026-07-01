import styles from "./AiAnalysisDashboard.module.scss";
import { ExplanationDetails } from "./HelpTooltip";
import { useAiAnalysisI18n } from "./i18n";

export function HowToReadAnalysis() {
  const { tr } = useAiAnalysisI18n();
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.howToRead.title")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.howToRead.description")}</p>
        </div>
      </div>
      <ExplanationDetails summary={tr("aiAnalysisDashboard.howToRead.open")}>
        <div className={styles.explanationGrid}>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.howToRead.personaVsRiskTitle")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.howToRead.personaVsRiskText")}
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.howToRead.scoresTitle")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.howToRead.scoresText")}
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.howToRead.evidenceTitle")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.howToRead.evidenceText")}
            </p>
          </div>
          <div className={styles.explanationBlock}>
            <div className={styles.cardMetaLabel}>{tr("aiAnalysisDashboard.howToRead.limitationsTitle")}</div>
            <p className={styles.inlineHelpText}>
              {tr("aiAnalysisDashboard.howToRead.limitationsText")}
            </p>
          </div>
        </div>
      </ExplanationDetails>
    </section>
  );
}
