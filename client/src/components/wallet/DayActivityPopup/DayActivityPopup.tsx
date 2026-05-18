import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchDayActivitySummary,
  type WalletDayActivitySummary,
} from "@/services/wallet/walletApi";
import { Close, Draggable } from "@carbon/icons-react";
import { SkeletonText, TextAreaSkeleton } from "@carbon/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TokenStack } from "./TokenStack";
import { TxRow } from "./TxRow";
import { WalletSelector } from "./WalletSelector";
import styles from "./DayActivityPopup.module.scss";

interface DayActivityPopupProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: string[];
  dayTimestamp: number;
}

const DEFAULT_POSITION = { x: 0, y: 100 };

export const DayActivityPopup: React.FC<DayActivityPopupProps> = ({
  isOpen,
  onClose,
  wallets,
  dayTimestamp,
}) => {
  const { fmt, tr } = useLocalization();
  const [selectedWallet, setSelectedWallet] = useState(wallets[0] ?? "");
  const [summary, setSummary] = useState<WalletDayActivitySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [position, setPosition] = useState(DEFAULT_POSITION);
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (wallets.length > 0 && !wallets.includes(selectedWallet)) {
      setSelectedWallet(wallets[0] ?? "");
    }
  }, [isOpen, wallets, selectedWallet]);

  useEffect(() => {
    if (!isOpen || !selectedWallet) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDayActivitySummary(selectedWallet, dayTimestamp)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load activity");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedWallet, dayTimestamp]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const newX = e.clientX - dragOffset.current.x;
      const newY = e.clientY - dragOffset.current.y;
      setPosition({ x: newX, y: newY });
    };

    const onMouseUp = () => {
      setDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  if (!isOpen) return null;

  const dateStr = new Date(dayTimestamp).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      ref={panelRef}
      className={`${styles.card} ${dragging ? styles.dragging : ""}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className={styles.header} onMouseDown={handleMouseDown}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <Draggable size={16} className={styles.dragIcon} />
            <h2 className={styles.title}>{tr("walletPage.activity")}</h2>
            <h3 className={styles.date}>{fmt.datetime.date(dateStr)}</h3>
          </div>
        </div>
        <button className={styles.closeBtn} onClick={onClose} aria-label={tr("common.cancel")}>
          <Close size={20} />
        </button>
      </div>

      {wallets.length > 1 && (
        <WalletSelector
          wallets={wallets}
          selected={selectedWallet}
          onSelect={setSelectedWallet}
        />
      )}

      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingStatRows}>
            <div className={styles.loadingStatRow}>
              <SkeletonText width="6rem" />
              <SkeletonText width="4rem" />
            </div>
            <div className={styles.loadingStatRow}>
              <SkeletonText width="8rem" />
              <SkeletonText width="6rem" />
            </div>
            <div className={styles.loadingStatRow}>
              <SkeletonText width="8rem" />
              <SkeletonText width="4rem" />
            </div>
          </div>
          <TextAreaSkeleton />
          <TextAreaSkeleton />
        </div>
      )}

      {error && (
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {summary && !loading && (
        <div className={styles.body}>
          <div className={styles.statsSection}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>{tr("wallet.tradingVolume")}</span>
              <span className={styles.statValue}>
                {fmt.num.compact.currency(summary.buyVolumeUsd + summary.sellVolumeUsd)}
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>
                {tr("wallet.tradingVolume")} ({tr("walletPage.buy")}/{tr("walletPage.sell")})
              </span>
              <span className={styles.statValue}>
                <span className={styles.subStatValuePositive}>{fmt.num.compact.currency(summary.buyVolumeUsd)}</span>
                {" / "}
                <span className={styles.subStatValueNegative}>{fmt.num.compact.currency(summary.sellVolumeUsd)}</span>
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>
                {tr("wallet.transactionCount")} ({tr("walletPage.buy")}/{tr("walletPage.sell")})
              </span>
              <span className={styles.statValue}>
                <span className={styles.subStatValuePositive}>{fmt.num.decimal(summary.buyTxCount)}</span>
                {" / "}
                <span className={styles.subStatValueNegative}>{fmt.num.decimal(summary.sellTxCount)}</span>
              </span>
            </div>
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{tr("wallet.tokensTraded")}</h3>
            <TokenStack
              tokens={summary.allTokens}
              totalTokens={summary.totalTokensTraded}
            />
          </div>

          <div className={styles.section}>
            <h3 className={styles.sectionTitle}>{tr("walletPage.transactions")}</h3>
            <div className={styles.txList}>
              {summary.swaps.length === 0 ? (
                <p className={styles.emptyText}>{tr("common.noData")}</p>
              ) : (
                summary.swaps.map((swap) => (
                  <TxRow
                    key={swap.transactionHash}
                    walletAddress={selectedWallet}
                    swap={swap}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
