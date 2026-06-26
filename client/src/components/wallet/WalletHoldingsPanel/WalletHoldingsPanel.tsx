import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import {
  FilterType,
  type FilterConfig,
  SortType,
  Table,
} from "@/components/tables/Table.tsx";
import {
  renderBase,
  renderReducedNumber,
} from "@/components/tables/TableCellRenderer.tsx";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import { locale } from "@/config/localization/index.ts";
import {
  Star,
  StarFilled,
  User,
} from "@carbon/icons-react";
import { IconButton } from "@carbon/react";
import {
  buildPortfolioMetaMap,
  isNativeSolToken,
  mapPortfolioItems,
} from "@/util/wallet-portfolio-mapper.ts";
import type { WalletPortfolioItem } from "@/services/wallet/walletApi";
import styles from "./WalletHoldingsPanel.module.scss";

interface WalletHoldingsPanelProps {
  walletAddress: string;
  portfolio: WalletPortfolioItem[];
  portfolioMeta: Map<number, { tokenAddress: string; logoUri: string | null; fullName: string | null }>;
  loading: boolean;
  actions?: React.ReactNode;
}

function resolveTokenMetaLookupAddress(
  tokenAddress: string | undefined,
): string | undefined {
  if (!tokenAddress) return undefined;
  const normalized = tokenAddress.trim().toLowerCase();
  if (
    normalized === "native" ||
    normalized === "sol" ||
    normalized === "11111111111111111111111111111111" ||
    normalized === "so11111111111111111111111111111111111111111"
  ) {
    return "So11111111111111111111111111111111111111112";
  }
  return tokenAddress;
}

export function WalletHoldingsPanel({
  walletAddress,
  portfolio,
  portfolioMeta,
  loading,
  actions,
}: WalletHoldingsPanelProps) {
  const { tr, fmt, lang } = useLocalization();
  const { user } = useAuth();
  const { tokenWatchlist, tokenPending, toggleToken } = useWatchlist();
  const navigate = useNavigate();
  const bcp47 = locale[lang].langCode;

  const { rows: portfolioData, meta: portfolioMetaRows } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );

  const portfolioMetaMap = useMemo(
    () => buildPortfolioMetaMap(portfolioMetaRows),
    [portfolioMetaRows],
  );

  const portfolioTableData = useMemo(
    () =>
      portfolioData.map((row: (string | number)[], rowIndex: number) => [
        portfolioMetaRows[rowIndex]?.tokenAddress ?? "",
        ...row,
      ]),
    [portfolioData, portfolioMetaRows],
  );

  const tokenWatchlistLookup = useMemo(
    () => new Set(tokenWatchlist.map((item) => item.toLowerCase())),
    [tokenWatchlist],
  );

  const portfolioHeaders = [
    { header: "", align: "center" as const, minWidth: "3.25rem" },
    { header: tr("walletPage.token"), align: "start" as const, minWidth: "11rem" },
    { header: tr("walletPage.price"), align: "end" as const, minWidth: "8rem" },
    { header: tr("walletPage.holding"), align: "end" as const, minWidth: "8rem" },
    { header: tr("walletPage.value"), align: "end" as const, minWidth: "8.5rem" },
  ];

  const isSortablePortfolio = [false, false, true, true, true];

  const portfolioSortConfig = {
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  const portfolioFilterSchema: Record<number, FilterConfig | null> = {
    1: { type: FilterType.Select },
    2: { type: FilterType.Range, min: 0, max: 500, step: 0.01 },
    3: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.001 },
    4: { type: FilterType.Range, min: 0, max: 100_000, step: 0.01 },
  };

  const portfolioCellRenderers = [
    (value: string) => {
      const tokenAddress =
        typeof value === "string" && value.trim().length > 0
          ? value
          : undefined;
      const watched = Boolean(
        tokenAddress && tokenWatchlistLookup.has(tokenAddress.toLowerCase()),
      );
      const pending = Boolean(tokenAddress && tokenPending[tokenAddress]);

      if (!tokenAddress) return null;

      return (
        <IconButton
          kind="ghost"
          size="sm"
          disabled={pending || !user}
          label={
            watched
              ? tr("marketPage.removeFromWatchlist")
              : tr("marketPage.addToWatchlist")
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void toggleToken(tokenAddress);
          }}
        >
          {watched ? <StarFilled size={16} /> : <Star size={16} />}
        </IconButton>
      );
    },
    (value: string) => {
      const portfolioTokenMeta = portfolioMetaMap.get(value);
      const tokenMetaLookupAddress = resolveTokenMetaLookupAddress(
        portfolioTokenMeta?.tokenAddress,
      );
      return (
        <TokenIdentityCell
          symbol={value}
          fullName={portfolioTokenMeta?.fullName}
          imageUrl={portfolioTokenMeta?.logoUri}
          imageSize={30}
          tooltipAlign="right"
        />
      );
    },
    (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? fmt.num.currency(n) : renderBase(value);
    },
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: unknown) => {
      const n = Number(value);
      return Number.isFinite(n) ? fmt.num.currency(n) : renderBase(value);
    },
  ];

  if (loading && portfolio.length === 0) {
    return (
      <div className={styles.holdingsPanel}>
        <div className={styles.holdingsHeader}>
          <span className={styles.holdingsTitle}>Holdings</span>
          {actions && <div>{actions}</div>}
        </div>
        <div className={styles.loadingSkeleton}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.holdingsPanel}>
      <div className={styles.chartSection}>
        <AssetDistribution
          initialFilters={{
            wallets: walletAddress ? [walletAddress] : [],
            timePeriod: "30D",
          }}
          autoRefresh
          minHeight={340}
        />
      </div>

      <div className={styles.tableSection}>
        <Table
          title={tr("walletPage.portfolio")}
          headers={portfolioHeaders}
          initialFilters={{}}
          fetcher={Promise.resolve(portfolioTableData)}
          filterSchema={portfolioFilterSchema}
          cellRenderers={portfolioCellRenderers}
          dataEntries={portfolioTableData}
          isSortable={isSortablePortfolio}
          sortConfigs={portfolioSortConfig}
          onRowClick={(_row: (string | number)[], rowIndex: number) => {
            const tokenAddress =
              rowIndex >= 0
                ? portfolioMeta.get(rowIndex)?.tokenAddress
                : undefined;
            if (tokenAddress && !isNativeSolToken(tokenAddress)) {
              navigate(`/tokens/${tokenAddress}`);
            }
          }}
          enableExport={false}
          loading={loading && portfolioTableData.length === 0}
        />
      </div>
    </div>
  );
}

export default WalletHoldingsPanel;
