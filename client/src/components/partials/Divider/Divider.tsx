import styles from "./Divider.module.scss";

export function Divider({ text }: { text?: string }) {
  return <div className={styles.divider}>{text && <small>{text}</small>}</div>;
}
