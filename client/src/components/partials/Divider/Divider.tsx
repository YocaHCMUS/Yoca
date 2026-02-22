import styles from "./Divider.module.scss";

export function Divider({ text }: { text?: string }) {
  return (
    <div className={styles.divider}>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
}
