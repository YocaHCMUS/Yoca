import styles from "./AiAnalysisDashboard.module.scss";
import { normalizeRiskLanguage, uniqueStrings } from "./utils";

const DEFAULT_DISCLAIMER =
  "Risk score reflects observed behavior in the analyzed transaction window. It is not financial advice, a legal judgment, or proof of fraud.";

export function CautionNotesSection({ notes }: { notes?: string[] }) {
  const cautionNotes = uniqueStrings([...(notes ?? []), DEFAULT_DISCLAIMER]);

  return (
    <section className={`${styles.sectionCard} ${styles.cautionCard}`}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.sectionTitle}>Caution Notes</h3>
          <p className={styles.sectionDescription}>How to interpret this analysis responsibly.</p>
        </div>
      </div>
      <div className={styles.notesList}>
        {cautionNotes.map((note, index) => (
          <p key={`${note}-${index}`} className={styles.noteText}>
            {note === DEFAULT_DISCLAIMER ? note : normalizeRiskLanguage(note)}
          </p>
        ))}
      </div>
    </section>
  );
}
