import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import { ChevronLeft, ChevronRight, PieChart, Search, Star, StarOff, WalletCards } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useUserTheme } from "@/contexts/ThemeContext";
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

const PORTFOLIO_PAGE_SIZE = 10;

const ALLOCATION_COLORS = ["#5867dd", "#1a9b80", "#ba7b14", "#a25fbe", "#3a8fc9", "#b85364"];

type AllocationSlice = {
  name: string;
  value: number;
  color: string;
};

export function WalletHoldingsPanel({
  portfolio,
  portfolioMeta,
  loading,
  actions,
}: WalletHoldingsPanelProps) {
  const { tr, fmt } = useLocalization();
  const { theme } = useUserTheme();
  const { user } = useAuth();
  const { tokenWatchlist, tokenPending, toggleToken } = useWatchlist();
  const navigate = useNavigate();
  const isDark = theme === "dark";

  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(
    () => [...portfolio].sort((left, right) => right.valueUsd - left.valueUsd),
    [portfolio],
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(
    () => !normalizedSearch
      ? rows
      : rows.filter((token) => `${token.symbol} ${token.name ?? ""} ${token.tokenAddress ?? ""}`.toLowerCase().includes(normalizedSearch)),
    [normalizedSearch, rows],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PORTFOLIO_PAGE_SIZE));
  const pageStart = (page - 1) * PORTFOLIO_PAGE_SIZE;
  const pagedRows = filteredRows.slice(pageStart, pageStart + PORTFOLIO_PAGE_SIZE);
  const totalValue = useMemo(
    () => rows.reduce((total, token) => total + (Number.isFinite(token.valueUsd) ? token.valueUsd : 0), 0),
    [rows],
  );
  const watchedTokens = useMemo(
    () => new Set(tokenWatchlist.map((item) => item.toLowerCase())),
    [tokenWatchlist],
  );
  const portfolioMetaByAddress = useMemo(
    () => new Map([...portfolioMeta.values()].map((item) => [item.tokenAddress, item])),
    [portfolioMeta],
  );

  useEffect(() => {
    setPage(1);
  }, [normalizedSearch]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, pageCount));
  }, [pageCount]);

  const allocationData = useMemo<AllocationSlice[]>(() => {
    if (totalValue <= 0) return [];

    const positiveRows = rows.filter((token) => Number.isFinite(token.valueUsd) && token.valueUsd > 0);
    const leadingTokens = positiveRows.slice(0, 5);
    const slices = leadingTokens.map((token, index) => ({
      name: token.symbol.toUpperCase(),
      value: token.valueUsd,
      color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length],
    }));

    const coveredValue = leadingTokens.reduce((total, token) => total + token.valueUsd, 0);
    const otherValue = Math.max(0, totalValue - coveredValue);
    const otherCount = Math.max(0, positiveRows.length - leadingTokens.length);

    if (otherValue > 0.01 && otherCount > 0) {
      slices.push({
        name: tr("walletPage.ui.assetsHeld", { count: otherCount }),
        value: otherValue,
        color: isDark ? "#52647d" : "#bcc7d7",
      });
    }

    return slices;
  }, [isDark, rows, totalValue, tr]);

  const allocationOption = useMemo<EChartsOption>(() => {
    const text = isDark ? "#e7ecf5" : "#172033";
    const muted = isDark ? "#9aa8bd" : "#67748a";
    const tooltipBackground = isDark ? "#171f2d" : "#ffffff";
    const tooltipBorder = isDark ? "#35455d" : "#dfe5ee";
    const panelBackground = isDark ? "#121925" : "#ffffff";

    return {
      animationDuration: 280,
      animationDurationUpdate: 220,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: tooltipBackground,
        borderColor: tooltipBorder,
        borderWidth: 1,
        padding: [7, 9],
        textStyle: { color: text, fontSize: 11 },
        formatter: (params: unknown) => {
          const item = params as { name?: string; value?: number; percent?: number };
          const value = Number(item.value ?? 0);
          const percent = Number(item.percent ?? 0);
          return `${item.name ?? ""}<br/>${fmt.num.currency(value)} · ${percent.toFixed(1)}%`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["61%", "83%"],
          center: ["50%", "50%"],
          clockwise: true,
          startAngle: 90,
          avoidLabelOverlap: true,
          selectedMode: false,
          label: { show: false },
          labelLine: { show: false },
          itemStyle: {
            borderColor: panelBackground,
            borderWidth: 3,
            borderRadius: 4,
          },
          emphasis: {
            scale: true,
            scaleSize: 5,
            itemStyle: {
              shadowBlur: 12,
              shadowColor: isDark ? "rgba(0, 0, 0, .34)" : "rgba(32, 45, 74, .16)",
            },
          },
          data: allocationData.map((item) => ({
            name: item.name,
            value: item.value,
            itemStyle: { color: item.color },
          })),
        },
      ],
      graphic: allocationData.length === 0
        ? [{
            type: "text",
            left: "center",
            top: "middle",
            style: {
              text: "—",
              fill: muted,
              fontSize: 18,
              fontWeight: 650,
              textAlign: "center",
            },
          }]
        : [],
    };
  }, [allocationData, fmt.num, isDark]);

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
        <div className={styles.chartFrame} aria-label={tr("walletPage.portfolio")}>
          <ReactECharts
            option={allocationOption}
            notMerge
            lazyUpdate
            style={{ height: 214, width: 214 }}
          />
          <div className={styles.chartCenter} aria-hidden="true">
            <strong>{fmt.num.compact.currency(totalValue)}</strong>
            <span>{tr("walletPage.total")}</span>
          </div>
        </div>

        <div className={styles.summaryText}>
          <span>{tr("walletPage.ui.totalPortfolio")}</span>
          <strong>{fmt.num.currency(totalValue)}</strong>
          <small>{tr("walletPage.ui.assetsHeld", { count: rows.length })}</small>

          {allocationData.length > 0 && (
            <div className={styles.allocationLegend}>
              {allocationData.slice(0, 5).map((item) => {
                const share = totalValue > 0 ? (item.value / totalValue) * 100 : 0;
                return (
                  <div key={item.name}>
                    <i style={{ background: item.color }} />
                    <span>{item.name}</span>
                    <em>{fmt.num.compact.currency(item.value)}</em>
                    <strong>{share.toFixed(1)}%</strong>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.chartCaption}>
        <PieChart size={13} strokeWidth={1.8} />
        <span>{tr("walletPage.portfolio")}</span>
      </div>

      <div className={styles.listToolbar}>
        <label className={styles.searchField}>
          <Search size={14} strokeWidth={1.9} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={tr("table.searchPlaceholder")}
            aria-label={tr("table.searchPlaceholder")}
          />
        </label>
        <span>{filteredRows.length}</span>
      </div>

      <div className={styles.listHeader}>
        <span>{tr("walletPage.token")}</span>
        <span>{tr("walletPage.balance")}</span>
        <span>{tr("walletPage.value")}</span>
        <span className={styles.watchHeader} aria-hidden="true" />
      </div>

      <div className={styles.list}>
        {filteredRows.length === 0 ? (
          <div className={styles.empty}>{tr("common.noData")}</div>
        ) : pagedRows.map((token) => {
          const meta = portfolioMetaByAddress.get(token.tokenAddress);
          const tokenAddress = token.tokenAddress || meta?.tokenAddress;
          const watched = Boolean(tokenAddress && watchedTokens.has(tokenAddress.toLowerCase()));
          const pending = Boolean(tokenAddress && tokenPending[tokenAddress]);
          const percent = totalValue > 0 ? (token.valueUsd / totalValue) * 100 : 0;
          const logo = token.logoUri ?? meta?.logoUri ?? null;
          const tokenName = token.name ?? meta?.fullName ?? token.symbol;

          return (
            <div key={tokenAddress || `${token.symbol}-${token.name ?? "token"}`} className={styles.row}>
              <button type="button" className={styles.tokenButton} onClick={() => tokenAddress && !isNativeSolToken(tokenAddress) && navigate(`/tokens/${tokenAddress}`)} disabled={!tokenAddress || isNativeSolToken(tokenAddress)}>
                {logo ? <img src={logo} alt="" /> : <span className={styles.tokenFallback}>{token.symbol.slice(0, 1).toUpperCase()}</span>}
                <span className={styles.tokenIdentity}><strong>{token.symbol.toUpperCase()}</strong><small>{tokenName}</small></span>
              </button>
              <div className={styles.rowBalance}>
                <strong>{fmt.num.compact.decimal(token.amount)}</strong>
                <small>{token.symbol.toUpperCase()}</small>
              </div>
              <div className={styles.rowValue}><strong>{fmt.num.currency(token.valueUsd)}</strong><small>{percent.toFixed(1)}%</small></div>
              <button type="button" className={styles.watchButton} onClick={() => tokenAddress && void toggleToken(tokenAddress)} disabled={!user || !tokenAddress || pending} title={watched ? String(tr("marketPage.removeFromWatchlist")) : String(tr("marketPage.addToWatchlist"))}>
                {watched ? <Star size={15} fill="currentColor" strokeWidth={1.8} /> : <StarOff size={15} strokeWidth={1.8} />}
              </button>
            </div>
          );
        })}
      </div>

      {filteredRows.length > 0 && (
        <footer className={styles.pagination}>
          <span>{tr("table.itemRangeText", {
            min: pageStart + 1,
            max: Math.min(pageStart + PORTFOLIO_PAGE_SIZE, filteredRows.length),
            count: filteredRows.length,
          })}</span>
          <div>
            <button type="button" onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))} disabled={page <= 1} aria-label={tr("table.previousPage")} title={tr("table.previousPage")}><ChevronLeft size={15} strokeWidth={1.9} /></button>
            <strong>{tr("table.pageRangeText", { count: page, total: pageCount })}</strong>
            <button type="button" onClick={() => setPage((currentPage) => Math.min(pageCount, currentPage + 1))} disabled={page >= pageCount} aria-label={tr("table.nextPage")} title={tr("table.nextPage")}><ChevronRight size={15} strokeWidth={1.9} /></button>
          </div>
        </footer>
      )}
    </section>
  );
}

export default WalletHoldingsPanel;
