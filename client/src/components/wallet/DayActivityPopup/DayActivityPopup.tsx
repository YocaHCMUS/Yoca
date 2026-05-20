import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchDayActivitySummary,
  type WalletDayActivitySummary,
  type WalletDayToken,
} from "@/services/wallet/walletApi";
import { Close, Draggable } from "@carbon/icons-react";
import { SkeletonText, TextAreaSkeleton } from "@carbon/react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { TokenStack } from "./TokenStack";
import { TxRow } from "./TxRow";
import { WalletSelector } from "./WalletSelector";
import styles from "./DayActivityPopup.module.scss";
import { ChartColumn } from '@carbon/react/icons';
import { TokenPriceChart } from "@/components/charts/TokenPriceChart/TokenPriceChart";
import type { TradeIndicator } from "@/components/charts/TokenPriceChart/TokenPriceChart";

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

  const [chartTokens, setChartTokens] = useState<WalletDayToken[]>([]);

  useEffect(() => {
    if (!isOpen) {
      setChartTokens([]);
      return;
    }
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

  const addChart = useCallback((token: WalletDayToken) => {
    setChartTokens((prev) => {
      if (prev.some((t) => t.address === token.address)) return prev;
      return [...prev, token];
    });
  }, []);

  const removeChart = useCallback((address: string) => {
    setChartTokens((prev) => prev.filter((t) => t.address !== address));
  }, []);

  const clearCharts = useCallback(() => {
    setChartTokens([]);
  }, []);

  const getTradesForToken = useCallback((token: WalletDayToken): TradeIndicator[] => {
    if (!summary) return [];
    const tokenSym = token.symbol.toLowerCase();
    return summary.swaps
      .filter((swap) => {
        const boughtSym = swap.boughtSymbol?.toLowerCase();
        const soldSym = swap.soldSymbol?.toLowerCase();
        if (boughtSym === tokenSym || soldSym === tokenSym) return true;
        const pairLower = swap.pair.toLowerCase();
        if (pairLower.includes(tokenSym)) return true;
        return false;
      })
      .map((swap) => {
        const boughtSym = swap.boughtSymbol?.toLowerCase();
        const soldSym = swap.soldSymbol?.toLowerCase();
        const isBoughtMatch = boughtSym === tokenSym;
        const isSoldMatch = soldSym === tokenSym;
        const tradeType: "buy" | "sell" = isBoughtMatch ? "buy" : isSoldMatch ? "sell" : "buy";
        const amount = isBoughtMatch ? swap.boughtAmount : isSoldMatch ? swap.soldAmount : swap.valueUsd;
        return {
          timestampMs: Date.parse(swap.timestamp),
          type: tradeType,
          price: 0,
          amount,
          symbol: token.symbol,
        };
      })
      .filter((t) => t.timestampMs > 0);
  }, [summary]);

  if (!isOpen) return null;

  const dateStr = new Date(dayTimestamp).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const hasCharts = chartTokens.length > 0;

  return (
    <div
      ref={panelRef}
      className={`${styles.card} ${dragging ? styles.dragging : ""} ${hasCharts ? styles.cardWithCharts : ""}`}
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div className={styles.mainContent}>
        <div className={styles.header} onMouseDown={handleMouseDown}>
          <div className={styles.headerLeft}>
            <div className={styles.titleRow}>
              <Draggable size={16} className={styles.dragIcon} />
              <h2 className={styles.title}>{tr("walletPage.activity")}</h2>
              <h3 className={styles.date}>{fmt.datetime.date(dateStr)}</h3>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.closeBtn} onClick={onClose} aria-label={tr("common.cancel")}>
              <Close size={20} />
            </button>
          </div>
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
                <span className={styles.statLabel}>
                  <ChartColumn />
                  {tr("wallet.tradingVolume")}
                </span>
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
                onTokenClick={addChart}
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

      {hasCharts && (
        <div className={styles.chartPanel}>
          <div className={styles.chartPanelHeader}>
            <span className={styles.chartPanelTitle}>{tr("wallet.tokensTraded")}</span>
            <button className={styles.clearChartsBtn} onClick={clearCharts} aria-label={tr("common.cancel")}>
              <Close size={16} />
            </button>
          </div>
          {chartTokens.map((token) => (
            <TokenPriceChart
              key={token.address}
              tokenAddress={token.address}
              tokenSymbol={token.symbol}
              tokenLogoUri={token.logoUri}
              dayMs={dayTimestamp}
              trades={getTradesForToken(token)}
              onRemove={() => removeChart(token.address)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
