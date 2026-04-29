import styles from "./ai-analysis.module.scss";
import {
  renderWalletAiReferenceText,
} from "@/services/wallet/walletAiReferenceRenderer.service.tsx";
import type { WalletAiReferenceEntry } from "@/services/wallet/walletApi.ts";

function normalizeSignals(signals: unknown): string[] {
  if (Array.isArray(signals)) {
    return signals.map((s) => String(s)).filter((s) => s.trim().length > 0);
  }
  if (signals == null) return [];
  return [String(signals)].filter((s) => s.trim().length > 0);
}

export function AiAnalysisSignalsList({
  signals,
  reference,
}: {
  signals: unknown;
  reference: WalletAiReferenceEntry[] | undefined;
}) {
  const items = normalizeSignals(signals);
  if (items.length === 0) {
    return <div>—</div>;
  }

  return (
    <div className={styles.signalsList}>
      {items.map((signal, idx) => (
        <div key={`${idx}-${signal.slice(0, 16)}`} className={styles.signalCard}>
          {renderWalletAiReferenceText(signal, reference, `signal-${idx}`)}
        </div>
      ))}
    </div>
  );
}

