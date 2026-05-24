import {
  AIAnalysisHeader,
  AnalysisMetricCards,
  AIBehaviorSummaryCard,
  KeyFindingsSection,
  RiskBreakdownSection,
  EvidenceHighlightsSection,
  CautionNotesSection,
  EmptyAnalysisState,
} from "@/components/wallet/AiAnalysisDashboard";
import styles from "@/components/wallet/AiAnalysisDashboard/AiAnalysisDashboard.module.scss";

type WalletAnalysisProfile = any;
type WalletAnalysisSummary = any;

export type WalletAnalystPanelProps = {
  profile: WalletAnalysisProfile;
  aiSummary: WalletAnalysisSummary;
  generatedAt: string;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export default function WalletAnalystPanel({
  profile,
  aiSummary,
  generatedAt,
  onRefresh,
  refreshing,
}: WalletAnalystPanelProps) {
  if (!profile || !aiSummary) {
    return (
      <div className={styles.panel}>
        <EmptyAnalysisState />
      </div>
    );
  }

  const actualTransactionCount = Number(profile.analysisWindow?.actualTransactionCount ?? 0);
  if (actualTransactionCount === 0) {
    return (
      <div className={styles.panel}>
        <AIAnalysisHeader generatedAt={generatedAt} onRefresh={onRefresh} refreshing={refreshing} />
        <EmptyAnalysisState />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <AIAnalysisHeader generatedAt={generatedAt} onRefresh={onRefresh} refreshing={refreshing} />
      <AnalysisMetricCards profile={profile} />
      <AIBehaviorSummaryCard aiSummary={aiSummary} />
      <KeyFindingsSection
        suspiciousFindings={aiSummary.suspiciousFindings}
        behaviorInsights={aiSummary.behaviorInsights}
      />
      <RiskBreakdownSection riskFactors={profile.risk?.riskFactors} />
      <EvidenceHighlightsSection
        evidenceHighlights={aiSummary.evidenceHighlights}
        profileEvidence={profile.evidence}
      />
      <CautionNotesSection notes={aiSummary.cautionNotes} />
    </div>
  );
}
