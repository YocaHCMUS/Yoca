import { Button, InlineLoading } from "@carbon/react";
import { CheckmarkFilled, CloseFilled } from "@carbon/react/icons";
import styles from "./ai-analysis.module.scss";
import type { AiAnalysisDependencyItem } from "./types";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";

function StatusIcon({ status }: { status: AiAnalysisDependencyItem["status"] }) {
  if (status === "available") return <CheckmarkFilled size={18} />;
  if (status === "fetching")
    return <InlineLoading status="active" aria-label="Fetching" />;
  return <CloseFilled size={18} />;
}

export function AiAnalysisDependencyPanel({
  items,
  canGenerate,
  generating,
  onGenerate,
}: {
  items: AiAnalysisDependencyItem[];
  canGenerate: boolean;
  generating: boolean;
  onGenerate: () => void;
}) {
  const { tr } = useLocalization();

  return (
    <div className={styles.sectionCard}>
      <div className={styles.sectionInner}>
        <div className={styles.titleRow}>
          <h3 className={styles.sectionTitle}>
            {String(tr("walletPage.aiDataReadiness"))}
          </h3>
          <p className={styles.sectionMeta}>
            {canGenerate
              ? String(tr("walletPage.aiDataAllAvailable"))
              : String(tr("walletPage.aiDataWaiting"))}
          </p>
        </div>

        <div className={styles.dependencyPanel}>
          <div className={styles.dependencyList}>
            {items.map((item) => {
              const statusClass =
                item.status === "available"
                  ? styles.statusAvailable
                  : item.status === "fetching"
                    ? styles.statusFetching
                    : styles.statusNoData;

              return (
                <div key={item.id} className={styles.dependencyRow}>
                  <div className={styles.dependencyLeft}>
                    <StatusIcon status={item.status} />
                    <div className={styles.dependencyLabel}>{item.label}</div>
                  </div>
                  <div className={`${styles.dependencyStatus} ${statusClass}`}>
                    {item.status === "available"
                      ? String(tr("walletPage.aiDepStatusAvailable"))
                      : item.status === "fetching"
                        ? String(tr("walletPage.aiDepStatusFetching"))
                        : String(tr("walletPage.aiDepStatusNoData"))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className={styles.ctaRow}>
            <Button
              size="sm"
              kind="primary"
              onClick={onGenerate}
              disabled={!canGenerate || generating}
            >
              {generating
                ? String(tr("walletPage.aiGenerating"))
                : String(tr("walletPage.aiGenerateAnalysis"))}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

