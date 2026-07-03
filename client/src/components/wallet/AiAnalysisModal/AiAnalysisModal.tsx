import { InlineLoading } from "@carbon/react";
import { Close } from "@carbon/react/icons";
import ReactDOM from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import WalletAnalystPanel from "@/components/WalletAnalystPanel.tsx";
import { ID_MODAL_ROOT } from "@/config/constants";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  analyzeWalletWithAI,
  type WalletAnalysisApiResponse,
} from "@/services/api/walletAnalysis.tsx";
import styles from "./AiAnalysisModal.module.scss";

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
  language: "vi" | "en";
}

export function AiAnalysisModal({
  isOpen,
  onClose,
  walletAddress,
  language,
}: AiAnalysisModalProps) {
  const { tr } = useLocalization();
  const [data, setData] = useState<WalletAnalysisApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const loadData = useCallback(
    async (forceRefresh = false) => {
      if (!walletAddress) return;

      const requestId = ++requestIdRef.current;
      setLoading(true);
      setError(null);

      if (!forceRefresh) {
        setData(null);
      }

      try {
        const result = await analyzeWalletWithAI({
          walletAddress,
          language,
          transactionLimit: 200,
          userLevel: "BEGINNER",
          maxSummaryLength: "SHORT",
        });

        if (requestId === requestIdRef.current) {
          setData(result);
          setLoading(false);
        }
      } catch (err) {
        if (requestId === requestIdRef.current) {
          const message =
            err instanceof Error ? err.message : tr("aiAnalysis.failed");
          setError(message);
          setLoading(false);
        }
      }
    },
    [walletAddress, language],
  );

  useEffect(() => {
    if (isOpen) {
      void loadData();
    } else {
      setData(null);
      setError(null);
      setLoading(false);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById(ID_MODAL_ROOT);
  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={tr("aiAnalysis.title")}>
        <div className={styles.header}>
          <span className={styles.title}>{tr("aiAnalysis.title")}</span>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label={tr("aiAnalysis.close")}>
            <Close size={20} />
          </button>
        </div>

        {loading && (
          <div className={styles.loadingState}>
            <InlineLoading description={tr("aiAnalysis.analyzing")} />
          </div>
        )}

        {!loading && error && (
          <div className={styles.errorState}>
            <p className={styles.errorMessage}>{error}</p>
            <button type="button" className={styles.retryBtn} onClick={() => void loadData(true)}>
              {tr("aiAnalysis.retry")}
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <WalletAnalystPanel
            profile={data.profile}
            aiSummary={data.aiSummary}
            generatedAt={data.generatedAt}
            refreshing={loading}
            onRefresh={() => void loadData(true)}
          />
        )}
      </div>
    </div>,
    modalRoot,
  );
}
