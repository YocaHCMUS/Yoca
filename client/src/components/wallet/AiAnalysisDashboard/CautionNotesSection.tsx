import styles from "./AiAnalysisDashboard.module.scss";
import { useAiAnalysisI18n } from "./i18n";
import { uniqueStrings } from "./utils";

export function CautionNotesSection({ notes }: { notes?: string[] }) {
  const { tr, normalizeUserText } = useAiAnalysisI18n();
  const defaultDisclaimer = String(tr("aiAnalysisDashboard.caution.defaultDisclaimer"));
  const labelDisclaimer = String(tr("aiAnalysisDashboard.caution.labelDisclaimer"));
  const cautionNotes = uniqueStrings([...(notes ?? []), defaultDisclaimer, labelDisclaimer]);

  return (
    <section className={`${styles.sectionCard} ${styles.cautionCard}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>{tr("aiAnalysisDashboard.caution.title")}</h3>
          <p className={styles.sectionDescription}>{tr("aiAnalysisDashboard.caution.description")}</p>
        </div>
      </div>
      <div className={styles.notesList}>
        {cautionNotes.map((note, index) => (
          <p key={`${note}-${index}`} className={styles.noteText}>
            {note === defaultDisclaimer || note === labelDisclaimer ? note : normalizeUserText(note)}
          </p>
        ))}
      </div>
    </section>
  );
}
