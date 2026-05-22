import { useLocalization } from "@/contexts/LocalizationContext";
import type { TokenResult } from "./TokenResultItem";
import styles from "./TokenStatsPanel.module.scss";
import { TrendNum } from "../TrendNum";

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({
  data,
  positive,
}: {
  data: number[] | null;
  positive: boolean | null;
}) {
  if (!data || data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 300;
  const height = 60;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`${styles.sparkline} ${positive === false ? styles.negative : ""}`}
      preserveAspectRatio="none"
    >
      <polyline points={points} />
    </svg>
  );
}

// ─── TokenStatsPanel ──────────────────────────────────────────────────────────

interface TokenStatsPanelProps {
  token: TokenResult | null;
}

export function TokenStatsPanel({ token }: TokenStatsPanelProps) {
  const { tr, fmt } = useLocalization();

  if (!token) {
    return (
      <aside className={styles.statsPanel}>
        <div className={styles.stateMsg}></div>
      </aside>
    );
  }

  const sparkData = token.sparkline7d;

  return (
    <aside className={styles.statsPanel}>
      <div className={styles.statsHeader}>
        <h3>{token.name} Stats</h3>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statsRow}>
          <span className={styles.label}>{tr("nav.searchPrice")}</span>
          <span className={styles.value}>
            {fmt.num.currency(token.priceUsd)}
          </span>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.label}>24h%</span>
          <TrendNum
            value={token.priceChangePercentage24h}
            prefixes="arrow"
            formatter={fmt.num.percent}
          />
        </div>
        <div className={styles.statsRow}>
          <span className={styles.label}>{tr("nav.searchMarketCap")}</span>
          <span className={styles.value}>
            {fmt.num.compact.currency(token.marketCap)}
          </span>
        </div>
        <div className={styles.statsRow}>
          <span className={styles.label}>{tr("nav.searchVolume")}</span>
          <span className={styles.value}>
            {fmt.num.compact.currency(token.volume24h)}
          </span>
        </div>
      </div>

      <div className={styles.chartContainer}>
        <span className={styles.label}>{tr("nav.searchLast7Days")}</span>
        <Sparkline
          data={sparkData}
          positive={token.priceChangePercentage24h > 0}
        />
      </div>
    </aside>
  );
}
