import { Button, TextAreaSkeleton } from "@carbon/react";
import styles from "./ai-analysis.module.scss";
import type { WalletAiAnalysisResponse } from "@/services/wallet/walletApi.ts";
import {
  renderWalletAiReferenceText,
} from "@/services/wallet/walletAiReferenceRenderer.service.tsx";
import { AiAnalysisDependencyPanel } from "./AiAnalysisDependencyPanel";
import { AiAnalysisSignalsList } from "./AiAnalysisSignalsList";
import type { AiAnalysisDependencyItem } from "./types";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import type { ReactNode } from "react";
import { FingerprintRecognition, Report, UserProfile, Purchase, Hourglass, ConnectionSignal } from "@carbon/react/icons";

function formatTimestampOrIso(
  value: unknown,
  fmtDatetime: (value: string | number | Date) => string,
): string {
  if (value == null) return "—";

  let parsed: number | string | null = null;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string") {
    const raw = value.trim();
    if (!raw) return "—";

    // Accept numeric strings as ms timestamps too.
    if (/^\d+$/.test(raw)) {
      parsed = Number(raw);
    } else {
      parsed = raw;
    }
  }

  if (parsed == null) return String(value);

  const date = new Date(parsed);
  if (Number.isNaN(date.getTime())) return String(value);

  return fmtDatetime(parsed);
}

function renderCommaSeparatedReferenceList(
  items: unknown,
  reference: WalletAiAnalysisResponse["reference"] | undefined,
  keyPrefix: string,
): ReactNode {
  if (!Array.isArray(items) || items.length === 0) return "—";

  const parts: ReactNode[] = [];
  for (let i = 0; i < items.length; i += 1) {
    const raw = items[i];
    const text = String(raw ?? "").trim();
    if (!text) continue;

    if (parts.length > 0) parts.push(", ");
    parts.push(renderWalletAiReferenceText(text, reference, `${keyPrefix}-${i}`));
  }

  return parts.length > 0 ? parts : "—";
}

export function AiAnalysisTab({
  aiAnalysisLoading,
  aiAnalysisError,
  aiAnalysisWaitingReason,
  aiAnalysisReport,
  aiAnalysisLastUpdated,
  dependencyItems,
  canGenerate,
  onGenerate,
  onRetry,
}: {
  aiAnalysisLoading: boolean;
  aiAnalysisError: string | null;
  aiAnalysisWaitingReason: string | null;
  aiAnalysisReport: WalletAiAnalysisResponse | null;
  aiAnalysisLastUpdated: string | null;
  dependencyItems: AiAnalysisDependencyItem[];
  canGenerate: boolean;
  onGenerate: () => void;
  onRetry: () => void;
}) {
  const { tr, fmt } = useLocalization();
  const showReadinessPanel = dependencyItems.length > 0;

  return (
    <div className={styles.stack}>
      {showReadinessPanel ? (
        <AiAnalysisDependencyPanel
          items={dependencyItems}
          canGenerate={canGenerate}
          generating={aiAnalysisLoading}
          onGenerate={onGenerate}
        />
      ) : null}

      {aiAnalysisLoading ? (
        // <div className={styles.sectionCard}>
        //   <div className={styles.sectionInner}>
        //     {String(tr("walletPage.aiAnalysisLoading"))}
        //   </div>
        // </div>
        <TextAreaSkeleton
          hideLabel
          aria-label={String(tr("walletPage.aiAnalysisLoading"))}
        />
      ) : aiAnalysisError ? (
        <div className={styles.sectionCard}>
          <div className={styles.sectionInner}>
            <div>{String(tr("walletPage.aiAnalysisFailed"))}</div>
            <div className={styles.errorText}>{aiAnalysisError}</div>
          </div>
        </div>
      ) : !aiAnalysisReport ? (
        <div className={styles.sectionCard}>
          <div className={styles.sectionInner}>
            {aiAnalysisWaitingReason
              ? aiAnalysisWaitingReason
              : String(tr("walletPage.aiNoData"))}
          </div>
        </div>
      ) : (
        <div className={styles.stack}>
          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <div className={styles.titleRow}>
                <h3 className={styles.sectionTitle}>
                  <Report size={20} />
                  {String(tr("walletPage.aiSummary"))}
                </h3>
                {aiAnalysisLastUpdated ? (
                  <p className={styles.sectionMeta}>
                    {String(tr("walletPage.aiLastUpdated"))}: {aiAnalysisLastUpdated}
                  </p>
                ) : null}
              </div>
              <div>
                {renderWalletAiReferenceText(
                  aiAnalysisReport.summary,
                  aiAnalysisReport.reference,
                  "summary",
                )}
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <h3 className={styles.sectionTitle}>
                <UserProfile size={20} />
                {String(tr("walletPage.aiActivityProfile"))}
              </h3>
              <div className={styles.kvGrid} style={{ marginTop: 8 }}>
                <div>
                  <strong>{String(tr("walletPage.aiArchetype"))}: </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.activity_profile.archetype,
                    aiAnalysisReport.reference,
                    "activity-archetype",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiActivityLevel"))}: </strong>
                  {aiAnalysisReport.activity_profile.activity_level}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiLastActive"))}: </strong>
                  {renderWalletAiReferenceText(
                    formatTimestampOrIso(
                      aiAnalysisReport.activity_profile.last_active,
                      fmt.datetime.datetime,
                    ),
                    aiAnalysisReport.reference,
                    "activity-last-active",
                  )}
                </div>
              </div>
            </div>
          </div>


          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <h3 className={styles.sectionTitle}>
                <FingerprintRecognition size={20} />
                {String(tr("walletPage.aiInteractionFingerprint"))}
              </h3>
              <div className={styles.kvGrid} style={{ marginTop: 8 }}>
                <div>
                  <strong>{String(tr("walletPage.aiPreferredProtocols"))}: </strong>
                  {renderCommaSeparatedReferenceList(
                    aiAnalysisReport.interaction_fingerprint.preferred_protocols,
                    aiAnalysisReport.reference,
                    "preferred-protocols",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiTransactionTiming"))}: </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.interaction_fingerprint.transaction_timing,
                    aiAnalysisReport.reference,
                    "transaction-timing",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiPreferredTradingTokens"))}: </strong>
                  {renderCommaSeparatedReferenceList(
                    aiAnalysisReport.interaction_fingerprint.preffered_trading_tokens,
                    aiAnalysisReport.reference,
                    "preferred-trading-tokens",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiPreferredHoldingTokens"))}: </strong>
                  {renderCommaSeparatedReferenceList(
                    aiAnalysisReport.interaction_fingerprint.preffered_holding_tokens,
                    aiAnalysisReport.reference,
                    "preferred-holding-tokens",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiTradingVolumeRange"))}: </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.interaction_fingerprint.trading_volume_range,
                    aiAnalysisReport.reference,
                    "trading-volume-range",
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <h3 className={styles.sectionTitle}>
                <Purchase size={20} />
                {String(tr("walletPage.aiFunder"))}
              </h3>
              <div className={styles.kvGrid} style={{ marginTop: 8 }}>
                <div>
                  <strong>{String(tr("walletPage.aiFunderType"))}: </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.funder.type,
                    aiAnalysisReport.reference,
                    "funder-type",
                  )}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiNotes"))}: </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.funder.notes,
                    aiAnalysisReport.reference,
                    "funder-notes",
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <h3 className={styles.sectionTitle}>
                <Hourglass size={20} />
                {String(tr("walletPage.aiWalletAge"))}
              </h3>
              <div className={styles.kvGrid} style={{ marginTop: 8 }}>
                <div>
                  <strong>{String(tr("walletPage.aiAgeCategory"))}: </strong>
                  {aiAnalysisReport.wallet_age.category}
                </div>
                <div>
                  <strong>{String(tr("walletPage.aiFirstSeen"))}: </strong>
                  {aiAnalysisReport.wallet_age.first_seen}
                </div>
                <div>
                  <strong>
                    {String(tr("walletPage.aiConsistencyAssessment"))}:{" "}
                  </strong>
                  {renderWalletAiReferenceText(
                    aiAnalysisReport.wallet_age.consistency,
                    aiAnalysisReport.reference,
                    "wallet-age-consistency",
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.sectionCard}>
            <div className={styles.sectionInner}>
              <h3 className={styles.sectionTitle}>
                <ConnectionSignal size={20} />
                {String(tr("walletPage.aiSignals"))}
              </h3>
              <div style={{ marginTop: 8 }}>
                <AiAnalysisSignalsList
                  signals={aiAnalysisReport.signals}
                  reference={aiAnalysisReport.reference}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

