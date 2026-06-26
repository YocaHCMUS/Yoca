import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Star, StarOff, WalletCards } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import type { WalletPortfolioItem } from "@/services/wallet/walletApi";
import { isNativeSolToken } from "@/util/wallet-portfolio-mapper";
import styles from "./WalletHoldingsPanel.module.scss";

interface WalletHoldingsPanelProps {
  walletAddress: string;
  portfolio: WalletPortfolioItem[];
  portfolioMeta: Map<number, { tokenAddress: string; logoUri: string | null; fullName: string | null }>;
  loading: boolean;
  actions?: React.ReactNode;
}

const ALLOCATION_COLORS = ["#5867dd", "#1a9b80", "#ba7b14", "#a25fbe", "#3a8fc9", "#b85364"];

export function WalletHoldingsPanel({
  portfolio,
  portfolioMeta,
  loading,
  actions,
}: WalletHoldingsPanelProps) {
  const { tr, fmt } = useLocalization();
  const { user } = useAuth();
  const { tokenWatchlist, tokenPending, toggleToken } = useWatchlist();
  const navigate = useNavigate();

  const rows = useMemo(
    () => [...portfolio].sort((left, right) => right.valueUsd - left.valueUsd),
    [portfolio],
  );
  const totalValue = useMemo(
    () => rows.reduce((total, token) => total + (Number.isFinite(token.valueUsd) ? token.valueUsd : 0), 0),
    [rows],
  );
  const topRows = rows.slice(0, 5);
  const watchedTokens = useMemo(
    () => new Set(tokenWatchlist.map((item) => item.toLowerCase())),
    [tokenWatchlist],
  );

  const gradient = useMemo(() => {
    if (topRows.length === 0 || totalValue <= 0) return "conic-gradient(var(--wallet-border) 0 100%)";
    let cursor = 0;
    const stops = topRows.map((token, index) => {
      const amount = Math.max(0, (token.valueUsd / totalValue) * 100);
      const next = Math.min(cursor + amount, 100);
      const color = ALLOCATION_COLORS[index % ALLOCATION_COLORS.length];
      const stop = `${color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
      cursor = next;
      return stop;
    });
    if (cursor < 100) stops.push(`var(--wallet-border) ${cursor.toFixed(2)}% 100%`);
    return `conic-gradient(${stops.join(",")})`;
  }, [topRows, totalValue]);

  if (loading && rows.length === 0) {
    return (
      <section className={styles.panel} aria-label={tr("walletPage.holdings")}>
        <header className={styles.header}><div className={styles.heading}><span className={styles.icon}><WalletCards size={17} strokeWidth={1.75} /></span><div><h2>{tr("walletPage.holdings")}</h2><p>{tr("walletPage.portfolio")}</p></div></div></header>
        <div className={styles.loadingList}>{Array.from({ length: 5 }).map((_, index) => <span key={index} />)}</div>
      </section>
    );
  }

  return (
    <section className={styles.panel} aria-label={tr("walletPage.holdings")}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.icon}><WalletCards size={17} strokeWidth={1.75} /></span>
          <div><h2>{tr("walletPage.holdings")}</h2><p>{tr("walletPage.portfolio")}</p></div>
        </div>
        {actions && <div className={styles.headerActions}>{actions}</div>}
      </header>

      <div className={styles.summary}>
        <div className={styles.allocationRing} style={{ background: gradient }}><span>{fmt.num.compact.currency(totalValue)}</span></div>
        <div className={styles.summaryText}>
          <span>{tr("walletPage.ui.totalPortfolio")}</span>
          <strong>{fmt.num.currency(totalValue)}</strong>
          <small>{tr("walletPage.ui.assetsHeld", { count: rows.length })}</small>
        </div>
      </div>

      <div className={styles.listHeader}>
        <span>{tr("walletPage.token")}</span>
        <span>{tr("walletPage.value")}</span>
      </div>

      <div className={styles.list}>
        {rows.length === 0 ? (
          <div className={styles.empty}>{tr("common.noData")}</div>
        ) : rows.map((token, index) => {
          const meta = portfolioMeta.get(index);
          const tokenAddress = token.tokenAddress || meta?.tokenAddress;
          const watched = Boolean(tokenAddress && watchedTokens.has(tokenAddress.toLowerCase()));
          const pending = Boolean(tokenAddress && tokenPending[tokenAddress]);
          const percent = totalValue > 0 ? (token.valueUsd / totalValue) * 100 : 0;
          const logo = token.logoUri ?? meta?.logoUri ?? null;
          const tokenName = token.name ?? meta?.fullName ?? token.symbol;

          return (
            <div key={tokenAddress || `${token.symbol}-${index}`} className={styles.row}>
              <button type="button" className={styles.tokenButton} onClick={() => tokenAddress && !isNativeSolToken(tokenAddress) && navigate(`/tokens/${tokenAddress}`)} disabled={!tokenAddress || isNativeSolToken(tokenAddress)}>
                {logo ? <img src={logo} alt="" /> : <span className={styles.tokenFallback}>{token.symbol.slice(0, 1).toUpperCase()}</span>}
                <span className={styles.tokenIdentity}><strong>{token.symbol.toUpperCase()}</strong><small>{tokenName}</small></span>
              </button>
              <div className={styles.rowValue}><strong>{fmt.num.currency(token.valueUsd)}</strong><small>{percent.toFixed(1)}%</small></div>
              <button type="button" className={styles.watchButton} onClick={() => tokenAddress && void toggleToken(tokenAddress)} disabled={!user || !tokenAddress || pending} title={watched ? String(tr("marketPage.removeFromWatchlist")) : String(tr("marketPage.addToWatchlist"))}>
                {watched ? <Star size={15} fill="currentColor" strokeWidth={1.8} /> : <StarOff size={15} strokeWidth={1.8} />}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default WalletHoldingsPanel;
