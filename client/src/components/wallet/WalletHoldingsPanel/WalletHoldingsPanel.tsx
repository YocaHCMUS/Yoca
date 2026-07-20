import { useMemo, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import { Star } from "lucide-react";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import Tble, {
  TbleFilterType,
  TbleSortType,
  type TblRw,
} from "@/components/Tble.tsx";
import {
  renderBase,
  renderReducedNumber,
} from "@/components/tables/TableCellRenderer.tsx";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import { locale } from "@/config/localization/index.ts";
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
}

interface HoldingTableRow extends TblRw {
  tokenAddress: string;
  tokenLabel: string;
  tokenName: string;
  priceUsd: number;
  amount: number;
  valueUsd: number;
}

export function WalletHoldingsPanel({
  walletAddress,
  portfolio,
  portfolioMeta,
  loading,
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

  const tokenWatchlistLookup = useMemo(
    () => new Set(tokenWatchlist.map((item) => item.toLowerCase())),
    [tokenWatchlist],
  );

  const holdingsRows = useMemo<HoldingTableRow[]>(
    () =>
      portfolioData.map((row, rowIndex) => {
        const tokenLabel = String(row[0] ?? "");
        const meta = portfolioMetaRows[rowIndex] ?? portfolioMeta.get(rowIndex);
        return {
          id: `${meta?.tokenAddress ?? tokenLabel}-${rowIndex}`,
          tokenAddress: meta?.tokenAddress ?? "",
          tokenLabel,
          tokenName: meta?.fullName ?? "",
          priceUsd: Number(row[1] ?? 0),
          amount: Number(row[2] ?? 0),
          valueUsd: Number(row[3] ?? 0),
          watchlist: meta?.tokenAddress ?? "",
          token: tokenLabel,
          price: Number(row[1] ?? 0),
          holdingValue: Number(row[3] ?? 0),
        };
      }),
    [portfolioData, portfolioMeta, portfolioMetaRows],
  );

  const portfolioHeaders = [
    { key: "watchlist", header: "", align: "center" as const, minWidth: "3rem", width: "3rem" },
    { key: "token", header: tr("walletPage.token"), align: "start" as const, minWidth: "11rem" },
    { key: "price", header: tr("walletPage.price"), align: "end" as const, minWidth: "7rem" },
    { key: "holdingValue", header: `${tr("walletPage.holding")} / ${tr("walletPage.value")}`, align: "end" as const, minWidth: "9rem" },
  ];

  const cellRenderers = {
    watchlist: (value: unknown) => {
      const tokenAddress = typeof value === "string" ? value : "";
      const watched = Boolean(
        tokenAddress && tokenWatchlistLookup.has(tokenAddress.toLowerCase()),
      );
      const pending = Boolean(tokenAddress && tokenPending[tokenAddress]);

      if (!tokenAddress) return null;

      return (
        <button
          type="button"
          className={`${styles.watchButton} ${watched ? styles.watchButtonActive : ""}`}
          disabled={pending || !user}
          aria-label={
            watched
              ? tr("marketPage.removeFromWatchlist")
              : tr("marketPage.addToWatchlist")
          }
          onClick={(event: MouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();
            void toggleToken(tokenAddress);
          }}
        >
          <Star size={16} />
        </button>
      );
    },
    token: (value: unknown) => {
      const tokenLabel = String(value ?? "");
      const portfolioTokenMeta = portfolioMetaMap.get(tokenLabel);
      return (
        <TokenIdentityCell
          symbol={tokenLabel}
          fullName={portfolioTokenMeta?.fullName}
          imageUrl={portfolioTokenMeta?.logoUri}
          imageSize={30}
          tooltipAlign="right"
        />
      );
    },
    price: (value: unknown) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? fmt.num.currency(numeric) : renderBase(value);
    },
    holdingValue: (_value: unknown, row: TblRw) => {
      const amount = Number(row.amount ?? 0);
      const valueUsd = Number(row.valueUsd ?? 0);
      return (
        <div className={styles.holdingValueCell}>
          <span className={styles.holdingAmount}>
            {renderReducedNumber(String(amount), renderBase, bcp47)}
          </span>
          <span className={styles.holdingUsd}>{fmt.num.currency(valueUsd)}</span>
        </div>
      );
    },
  };

  return (
    <div className={styles.holdingsPanel}>
      <AssetDistribution
        initialFilters={{
          wallets: walletAddress ? [walletAddress] : [],
          timePeriod: "30D",
        }}
        autoRefresh
        minHeight={340}
      />

      <Tble
        title={tr("walletPage.portfolio")}
        rows={holdingsRows}
        headers={portfolioHeaders}
        filterSchema={{
          token: { type: TbleFilterType.Select, field: "tokenLabel" },
          price: { type: TbleFilterType.Range, field: "priceUsd", min: 0, max: 500, step: 0.01 },
          holdingValue: {
            type: TbleFilterType.Composite,
            filters: {
              amount: { type: TbleFilterType.Range, field: "amount", min: 0, max: 1_000_000, step: 0.01 },
              value: { type: TbleFilterType.Range, field: "valueUsd", min: 0, max: 100_000, step: 0.01 },
            },
          },
        }}
        sortConfigs={{
          price: { type: TbleSortType.Number, field: "priceUsd" },
          holdingValue: { type: TbleSortType.Number, field: "valueUsd" },
        }}
        cellRenderers={cellRenderers}
        enableSearch
        searchFields={["tokenLabel", "tokenName", "tokenAddress"]}
        onRowClick={(row) => {
          const tokenAddress = String(row.tokenAddress ?? "");
          if (tokenAddress && !isNativeSolToken(tokenAddress)) {
            navigate(`/tokens/${tokenAddress}`);
          }
        }}
        enablePagination
        pageSize={16}
        boxed
        loading={loading && holdingsRows.length === 0}
      />
    </div>
  );
}

export default WalletHoldingsPanel;



