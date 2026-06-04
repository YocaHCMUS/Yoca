import { useLocalization } from "@/contexts/LocalizationContext";
import {
  fetchDayActivitySummary,
  type WalletDayActivitySummary,
  type WalletDaySwapSummary,
  type WalletDayToken,
} from "@/services/wallet/walletApi";
import { Close, Draggable, ChevronDown, ChevronUp } from "@carbon/icons-react";
import { SkeletonText, TextAreaSkeleton } from "@carbon/react";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TokenStack } from "./TokenStack";
import { TimelineView } from "./TimelineView";
import { TxRow } from "./TxRow";
import { WalletSelector } from "./WalletSelector";
import styles from "./DayActivityPopup.module.scss";
import { ChartColumn } from '@carbon/react/icons';
import { TokenPriceChart } from "@/components/charts/TokenPriceChart/TokenPriceChart";
import type { TradeIndicator } from "@/components/charts/TokenPriceChart/TokenPriceChart";
import TokenIdentityCell from "@/components/token/TokenIdentityCell";

interface DayActivityPopupProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: string[];
  dayTimestamp: number;
}

interface AggregatedTxGroup {
  action: "buy" | "sell";
  tokenSymbol: string;
  tokenLogoUri: string | null;
  totalAmount: number;
  totalVolumeUsd: number;
  tradeCount: number;
  swaps: WalletDaySwapSummary[];
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
  const [expandedTxGroup, setExpandedTxGroup] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "timeline">("list");

  useEffect(() => {
    if (!isOpen) {
      setChartTokens([]);
      setExpandedTxGroup(null);
      setViewMode("list");
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

  const tokenLogoMap = useMemo(() => {
    if (!summary) return {};
    const map: Record<string, string | null> = {};
    for (const t of summary.allTokens) {
      map[t.address] = t.logoUri;
    }
    return map;
  }, [summary]);

  const aggregatedTxs = useMemo((): AggregatedTxGroup[] => {
    if (!summary) return [];

    const logoMap = new Map<string, string | null>();
    for (const token of summary.allTokens) {
      logoMap.set(token.address, token.logoUri);
    }

    const groupMap = new Map<string, AggregatedTxGroup>();

    for (const swap of summary.swaps) {
      const boughtAddr = swap.boughtTokenAddress;
      const soldAddr = swap.soldTokenAddress;

      const boughtSym = swap.boughtSymbol;
      const soldSym = swap.soldSymbol;
      const isBuy = swap.action === "buy";

      const tokenAddr = isBuy ? boughtAddr : soldAddr;
      if (!tokenAddr) continue;
      const tokenSymbol = isBuy ? boughtSym : soldSym;
      if (!tokenSymbol) continue;

      const key = `${swap.action}-${tokenAddr}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.totalAmount += isBuy ? swap.boughtAmount : swap.soldAmount;
        existing.totalVolumeUsd += swap.valueUsd;
        existing.tradeCount += 1;
        existing.swaps.push(swap);
      } else {
        groupMap.set(key, {
          action: swap.action,
          tokenSymbol,
          tokenLogoUri: logoMap.get(tokenAddr) ?? null,
          totalAmount: isBuy ? swap.boughtAmount : swap.soldAmount,
          totalVolumeUsd: swap.valueUsd,
          tradeCount: 1,
          swaps: [swap],
        });
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => {
      const aTime = a.swaps[0]?.timestamp ? Date.parse(a.swaps[0].timestamp) : 0;
      const bTime = b.swaps[0]?.timestamp ? Date.parse(b.swaps[0].timestamp) : 0;
      return bTime - aTime;
    });
  }, [summary]);

  const getTradesForToken = useCallback((token: WalletDayToken) => {
    if (!summary) return [];
    const tokenAddr = token.address;
    const tokenSym = token.symbol.toLowerCase();
    return summary.swaps
      .filter((swap) => {
        const boughtAddr = swap.boughtTokenAddress;
        const soldAddr = swap.soldTokenAddress;
        if (boughtAddr === tokenAddr || soldAddr === tokenAddr) return true;
        return false;
      })
      .map((swap) => {
        const boughtAddr = swap.boughtTokenAddress;
        const soldAddr = swap.soldTokenAddress;
        const boughtSym = swap.boughtSymbol?.toLowerCase();
        const soldSym = swap.soldSymbol?.toLowerCase();
        const isBoughtMatch = boughtAddr === tokenAddr || boughtSym === tokenSym;
        const isSoldMatch = soldAddr === tokenAddr || soldSym === tokenSym;
        const tradeType: "buy" | "sell" = isBoughtMatch ? "buy" : isSoldMatch ? "sell" : "buy";
        const amount = isBoughtMatch ? swap.boughtAmount : isSoldMatch ? swap.soldAmount : swap.valueUsd;
        const price = isBoughtMatch
          ? (swap.valueUsd / swap.boughtAmount) || 0
          : (swap.valueUsd / swap.soldAmount) || 0;
        return {
          timestampMs: Date.parse(swap.timestamp),
          type: tradeType,
          price,
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
        <div className={styles.headerActions}>
          <button className={styles.closeBtn} onClick={onClose} aria-label={tr("common.cancel")}>
            <Close size={20} />
          </button>
        </div>
      </div>

      <div className={styles.columnGrid}>
        <div className={styles.mainContent}>
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
                <div className={styles.sectionHeaderRow}>
                  <h3 className={styles.sectionTitle}>{tr("walletPage.transactions")}</h3>
                  <div className={styles.viewToggle}>
                    <button
                      className={`${styles.toggleBtn} ${viewMode === "list" ? styles.toggleBtnActive : ""}`}
                      onClick={() => setViewMode("list")}
                    >
                      {tr("walletPage.list")}
                    </button>
                    <button
                      className={`${styles.toggleBtn} ${viewMode === "timeline" ? styles.toggleBtnActive : ""}`}
                      onClick={() => setViewMode("timeline")}
                    >
                      {tr("walletPage.timeline")}
                    </button>
                  </div>
                </div>

                {viewMode === "list" ? (
                  <div className={styles.txList}>
                    {aggregatedTxs.length === 0 ? (
                      <p className={styles.emptyText}>{tr("common.noData")}</p>
                    ) : (
                      aggregatedTxs.map((group) => {
                        const groupKey = `${group.action}-${group.tokenSymbol}`;
                        const isExpanded = expandedTxGroup === groupKey;
                        const actionLabel = group.action === "buy" ? tr("walletPage.buy") : tr("walletPage.sell");
                        const actionClass = group.action === "buy" ? styles.aggregatedTxActionBuy : styles.aggregatedTxActionSell;

                        return (
                          <React.Fragment key={groupKey}>
                            <div
                              className={styles.aggregatedTxRow}
                              onClick={() => setExpandedTxGroup(isExpanded ? null : groupKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setExpandedTxGroup(isExpanded ? null : groupKey);
                                }
                              }}
                            >
                              <span className={`${styles.aggregatedTxAction} ${actionClass}`}>
                                {actionLabel}
                              </span>
                              <span className={styles.aggregatedTxAmount}>
                                {fmt.num.compact.decimal(group.totalAmount)}
                              </span>
                              <TokenIdentityCell symbol={group.tokenSymbol} imageUrl={group.tokenLogoUri} imageSize={18} tooltipAlign="right" />
                              <span className={styles.aggregatedTxCount}>
                                {tr("walletPage.trade", { count: group.tradeCount })}
                              </span>
                              <span className={styles.aggregatedTxSpacer} />
                              <span className={styles.aggregatedTxVolume}>
                                {fmt.num.compact.currency(group.totalVolumeUsd)}
                              </span>
                              {isExpanded ? <ChevronUp size={16} className={styles.aggregatedTxChevron} /> : <ChevronDown size={16} className={styles.aggregatedTxChevron} />}
                            </div>
                            {isExpanded && (
                              <div className={styles.aggregatedTxDetail}>
                                {group.swaps.map((swap) => (
                                  <TxRow
                                    key={swap.transactionHash}
                                    walletAddress={selectedWallet}
                                    swap={swap}
                                  />
                                ))}
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <TimelineView
                    swaps={summary.swaps}
                    walletAddress={selectedWallet}
                    dayTimestamp={dayTimestamp}
                    tokenLogoMap={tokenLogoMap}
                  />
                )}
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
    </div>
  );
};
