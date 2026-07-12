import classNames from "classnames";
import { useLocalization } from "@/contexts/LocalizationContext";
import type { ChatSource } from "./types";
import styles from "./WalletChat.module.scss";

function SourceCard({
  source,
  idx,
  isHighlighted,
  onHover,
  onLeave,
}: {
  source: ChatSource;
  idx: number;
  isHighlighted: boolean;
  onHover: (num: number) => void;
  onLeave: () => void;
}) {
  const { fmt } = useLocalization();

  return (
    <div
      className={classNames(styles.sourceCard, { [styles.sourceCardHighlighted]: isHighlighted })}
      onMouseEnter={() => onHover(idx)}
      onMouseLeave={onLeave}
    >
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.sourceCardTitle}
      >
        {source.title}
      </a>
      <span className={styles.sourceCardDomain}>{source.source}</span>
      {source.snippet && <p className={styles.sourceCardSnippet}>{source.snippet}</p>}
      <div className={styles.sourceCardFooter}>
        {source.publishedAt && (
          <span className={styles.sourceCardDate}>{fmt.datetime.date(source.publishedAt)}</span>
        )}
      </div>
    </div>
  );
}

export interface SourcePanelProps {
  ids: string[];
  sources: ChatSource[];
  hoveredCiteIds: number[];
  position: { top: number; left: number };
  onHoverSource: (num: number) => void;
  onLeaveSource: () => void;
  onClose: () => void;
}

export function SourcePanel({
  ids,
  sources,
  hoveredCiteIds,
  position,
  onHoverSource,
  onLeaveSource,
  onClose,
}: SourcePanelProps) {
  const { tr } = useLocalization();
  const matched = ids
    .map((id) => ({ idx: parseInt(id, 10), source: sources[parseInt(id, 10) - 1] }))
    .filter((item) => item.source);

  if (matched.length === 0) return null;

  const panelWidth = 340;
  const clampedLeft = Math.max(4, Math.min(position.left, window.innerWidth - panelWidth - 4));

  return (
    <>
      <div className={styles.sourcePanelBackdrop} onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()} />
      <div
        className={styles.sourcePanel}
        style={{ top: position.top, left: clampedLeft }}
      >
        <div className={styles.sourcePanelHeader}>
          <span className={styles.sourcePanelTitle}>{tr("chat.sources")}</span>
        </div>
        {matched.map(({ idx, source }) => (
          <SourceCard
            key={idx}
            source={source}
            idx={idx}
            isHighlighted={hoveredCiteIds.includes(idx)}
            onHover={onHoverSource}
            onLeave={onLeaveSource}
          />
        ))}
      </div>
    </>
  );
}
