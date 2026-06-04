import { useLocalization } from "@/contexts/LocalizationContext";
import { type WalletDaySwapSummary } from "@/services/wallet/walletApi";
import { ChevronDown, ChevronUp } from "@carbon/icons-react";
import { useState, useMemo } from "react";
import { TxRow } from "./TxRow";
import TokenIdentityCell from "@/components/token/TokenIdentityCell";
import styles from "./TimelineView.module.scss";

interface TimelineBucket {
  hour: number;
  minute: number;
  label: string;
  swaps: WalletDaySwapSummary[];
  totalVolumeUsd: number;
  tradeCount: number;
  netAction: "buy" | "sell" | "mixed";
  topTokenSymbol?: string;
  topTokenLogoUri?: string | null;
  topTokenAmount?: number;
}

interface TimelineViewProps {
  swaps: WalletDaySwapSummary[];
  walletAddress: string;
  dayTimestamp: number;
  tokenLogoMap?: Record<string, string | null>;
}

const BUCKET_MS = 30 * 60 * 1000;

function buildTimeBuckets(swaps: WalletDaySwapSummary[], dayTimestamp: number, tokenLogoMap?: Record<string, string | null>): TimelineBucket[] {
  const startMs = dayTimestamp;

  type TokenAccum = { volume: number; amount: number; symbol: string; address: string };
  const bucketMap = new Map<number, { swaps: WalletDaySwapSummary[]; tokenVolumes: Map<string, TokenAccum> }>();

  for (const swap of swaps) {
    const ts = Date.parse(swap.timestamp);
    if (isNaN(ts)) continue;
    const bucketIndex = Math.floor((ts - startMs) / BUCKET_MS);
    if (bucketIndex < 0 || bucketIndex >= 48) continue;

    if (!bucketMap.has(bucketIndex)) {
      bucketMap.set(bucketIndex, { swaps: [], tokenVolumes: new Map() });
    }
    const entry = bucketMap.get(bucketIndex)!;
    entry.swaps.push(swap);

    const tokenAddr = swap.action === "buy" ? swap.boughtTokenAddress : swap.soldTokenAddress;
    const tokenSym = swap.action === "buy" ? swap.boughtSymbol : swap.soldSymbol;
    const amount = swap.action === "buy" ? swap.boughtAmount : swap.soldAmount;
    if (tokenAddr && tokenSym) {
      const existing = entry.tokenVolumes.get(tokenAddr);
      if (existing) {
        existing.volume += swap.valueUsd;
        existing.amount += amount;
      } else {
        entry.tokenVolumes.set(tokenAddr, { volume: swap.valueUsd, amount, symbol: tokenSym, address: tokenAddr });
      }
    }
  }

  const buckets: TimelineBucket[] = [];

  for (const [index, entry] of bucketMap) {
    const hour = Math.floor(index / 2);
    const minute = (index % 2) * 30;
    const totalVolume = entry.swaps.reduce((sum, s) => sum + s.valueUsd, 0);
    const buyCount = entry.swaps.filter((s) => s.action === "buy").length;
    const sellCount = entry.swaps.filter((s) => s.action === "sell").length;

    let netAction: "buy" | "sell" | "mixed";
    if (buyCount > 0 && sellCount === 0) netAction = "buy";
    else if (sellCount > 0 && buyCount === 0) netAction = "sell";
    else netAction = "mixed";

    let topToken: TokenAccum | undefined;
    let maxVol = 0;
    for (const [, v] of entry.tokenVolumes) {
      if (v.volume > maxVol) {
        maxVol = v.volume;
        topToken = v;
      }
    }

    const bucket: TimelineBucket = {
      hour,
      minute,
      label: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      swaps: entry.swaps,
      totalVolumeUsd: totalVolume,
      tradeCount: entry.swaps.length,
      netAction,
    };

    if (topToken && netAction !== "mixed") {
      bucket.topTokenSymbol = topToken.symbol;
      bucket.topTokenAmount = topToken.amount;
      bucket.topTokenLogoUri = tokenLogoMap?.[topToken.address] ?? null;
    }

    buckets.push(bucket);
  }

  return buckets.sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.minute - b.minute;
  });
}

export const TimelineView: React.FC<TimelineViewProps> = ({ swaps, walletAddress, dayTimestamp, tokenLogoMap }) => {
  const { fmt, tr } = useLocalization();
  const [expandedBucket, setExpandedBucket] = useState<string | null>(null);

  const buckets = useMemo(() => buildTimeBuckets(swaps, dayTimestamp, tokenLogoMap), [swaps, dayTimestamp, tokenLogoMap]);

  const toggleBucket = (key: string) => {
    setExpandedBucket((prev) => (prev === key ? null : key));
  };

  // if (buckets.length === 0) return null;
  return (
    <div className={styles.timeline}>
      {buckets.map((bucket) => {
        const key = `${bucket.hour}:${bucket.minute}`;
        const isExpanded = expandedBucket === key;
        const dotClass =
          bucket.netAction === "buy" ? styles.dotBuy
            : bucket.netAction === "sell" ? styles.dotSell
              : styles.dotMixed;

        return (
          <div key={key} className={styles.timelineNode}>
            <div className={styles.timeLabel}>{bucket.label}</div>
            <div className={styles.dotColumn}>
              <div className={`${styles.dot} ${dotClass}`} />
            </div>
            <div className={styles.nodeContent}>
              <div
                className={styles.summaryRow}
                onClick={() => toggleBucket(key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggleBucket(key);
                  }
                }}
              >
                {bucket.netAction === "mixed" ? (
                  <span className={styles.summaryMixed}>{tr("walletPage.mixed")}</span>
                ) : (
                  <>
                    <span
                      className={`${styles.summaryAction} ${bucket.netAction === "buy" ? styles.actionBuy : styles.actionSell
                        }`}
                    >
                      {bucket.netAction === "buy" ? tr("walletPage.buy") : tr("walletPage.sell")}
                    </span>
                    {bucket.topTokenAmount != null && (
                      <span className={styles.summaryAmount}>
                        {fmt.num.compact.decimal(bucket.topTokenAmount)}
                      </span>
                    )}
                    {bucket.topTokenSymbol && (
                      <TokenIdentityCell symbol={bucket.topTokenSymbol} imageUrl={bucket.topTokenLogoUri} imageSize={18} tooltipAlign="right" />
                    )}
                  </>
                )}
                <span className={styles.summaryCount}>
                  {tr("walletPage.trade", { count: bucket.tradeCount })}
                </span>
                <span className={styles.summarySpacer} />
                <span className={styles.summaryVolume}>
                  {fmt.num.compact.currency(bucket.totalVolumeUsd)}
                </span>
                {isExpanded ? (
                  <ChevronUp size={16} className={styles.chevron} />
                ) : (
                  <ChevronDown size={16} className={styles.chevron} />
                )}
              </div>
              {isExpanded && (
                <div className={styles.expandedDetail}>
                  {bucket.swaps.map((swap) => (
                    <TxRow key={swap.transactionHash} walletAddress={walletAddress} swap={swap} />
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
