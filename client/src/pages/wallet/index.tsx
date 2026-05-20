import client from "@/api/main";
import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { PnLChart } from "@/components/charts/PnLChart/index.ts";
import TabContainer from "@/components/tabContainer/tabContainer.tsx";
import {
  FilterType,
  type FilterConfig,
  SortType,
  Table,
  tableHeaderLabel,
} from "@/components/tables/Table.tsx";
import {
  renderBase,
  renderCode,
  renderDateTime,
  renderHash,
  renderReducedNumber,
  renderTokenCell,
} from "@/components/tables/TableCellRenderer.tsx";
import { TknImg } from "@/components/TknImg";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import {
  AiAnalysisTab,
  type AiAnalysisDependencyItem,
} from "@/components/wallet/AiAnalysis/index.ts";
import {
  WalletReportTemplate,
  type WalletReportSection,
} from "@/components/WalletReportTemplate";
import { WalletAuditPanel } from "@/components/wallet/WalletAuditPanel/WalletAuditPanel.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { locale } from "@/config/localization/index.ts";
import { useAuth } from "@/contexts/AuthContext.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { useWatchlist } from "@/contexts/WatchlistContext";
import { useExportReport } from "@/hooks/useExportReport.ts";
import { useGet } from "@/hooks/useGet";
import {
  fetchWalletSwaps,
  fetchWalletTransfers,
  fetchWalletPortfolio,
  fetchWalletOverview,
  fetchWalletIntelligence,
  fetchWalletAiAnalysis,
  type WalletSwap,
  type WalletTransfer,
  type WalletPortfolioItem,
  type WalletIntelligenceResponse,
  type WalletOverviewMultiPeriodResponse,
  type WalletPageInfo,
  type WalletSwapTokenChange,
  type WalletSwapTokenInfo,
  type WalletAiAnalysisLanguage,
  type WalletAiAnalysisResponse,
} from "@/services/wallet/walletApi.ts";
import { fetchWalletTags } from "@/services/wallet/walletTagsApi.ts";
import {
  Activity,
  AiGenerate,
  ChartLine,
  ChevronDown,
  Download,
  Star,
  StarFilled,
  User,
  Wallet,
} from "@carbon/icons-react";
import { Button, IconButton } from "@carbon/react";
import JSZip from "jszip";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { useNavigate, useParams } from "react-router";
import * as XLSX from "xlsx";
import {
  buildPortfolioMetaMap,
  mapPortfolioItems,
} from "../../util/wallet-portfolio-mapper.ts";
import styles from "./index.module.scss";
import {
  TokenAverageTradePrice,
  TokenDetailsDemo,
} from "./TokenDetailsDemo.tsx";
// import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { SwapDetailModal } from "@/components/wallet/SwapDetailModal/SwapDetailModal.tsx";
import { WalletOverview } from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { BalanceChartV2 } from "@/components/charts/BalanceChartV2/BalanceChartV2.tsx";

function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) {
    return [];
  }

  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }

  return output;
}

function getMaxLoadedPage<T>(pages: Record<number, T[]>): number {
  const loadedPages = Object.keys(pages)
    .map((page) => Number(page))
    .filter((page) => Number.isInteger(page) && page > 0);

  return loadedPages.length > 0 ? Math.max(...loadedPages) : 0;
}

function flattenLoadedPages<T>(pages: Record<number, T[]>): T[] {
  return Object.keys(pages)
    .map((page) => Number(page))
    .filter((page) => Number.isInteger(page) && page > 0)
    .sort((left, right) => left - right)
    .flatMap((page) => pages[page] ?? []);
}

const WSOL_MINT = "So11111111111111111111111111111111111111112";
const PDF_TABLE_ROWS_PER_PAGE = 20;
const PDF_CHUNK_PAGE_BASE_CLASS = "break-inside-avoid print:break-inside-avoid";
const PDF_CHUNK_PAGE_BREAK_CLASS = "break-after-page print:break-after-page";

function resolveTokenMetaLookupAddress(
  tokenAddress: string | undefined,
): string | undefined {
  if (!tokenAddress) {
    return undefined;
  }

  const normalized = tokenAddress.trim().toLowerCase();
  if (
    normalized === "native" ||
    normalized === "sol" ||
    normalized === "11111111111111111111111111111111" ||
    normalized === "so11111111111111111111111111111111111111111"
  ) {
    return WSOL_MINT;
  }

  return tokenAddress;
}

function PageSection({ children }: { children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionStack}>{children}</div>
    </section>
  );
}

export default function WalletPage() {
  const { user } = useAuth();
  const { tr, fmt, lang } = useLocalization();
  const { tokenWatchlist, tokenPending, toggleToken } = useWatchlist();
  const bcp47 = locale[lang].langCode;
  const navigate = useNavigate();
  const { address } = useParams<{ address: string }>();
  const walletAddress = address ?? "";
  const aiAnalysisLanguage: WalletAiAnalysisLanguage =
    lang === "vi" ? "vn" : "en";

  const [swapPages, setSwapPages] = useState<Record<number, WalletSwap[]>>({});
  const [swapPageInfoByPage, setSwapPageInfoByPage] = useState<
    Record<number, WalletPageInfo>
  >({});
  const [swapLoading, setSwapLoading] = useState(false);

  const [transferPages, setTransferPages] = useState<
    Record<number, WalletTransfer[]>
  >({});
  const [transferPageInfoByPage, setTransferPageInfoByPage] = useState<
    Record<number, WalletPageInfo>
  >({});
  const [transferLoading, setTransferLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [portfolio, setPortfolio] = useState<WalletPortfolioItem[]>([]);
  const [overviewReport, setOverviewReport] =
    useState<WalletOverviewMultiPeriodResponse | null>(null);
  const [intelligenceReport, setIntelligenceReport] =
    useState<WalletIntelligenceResponse | null>(null);
  const [intelligenceLoading, setIntelligenceLoading] = useState(false);
  const [walletTags, setWalletTags] = useState<string[]>([]);

  /** 0 Overview, 1 Holdings, 2 Activity / Risk, 3 Forensic Audit, 4 AI Analysis — data loads when each tab is first visited. */
  const [activeTab, setActiveTab] = useState(0);
  /** Gates GET /wallets/intelligence in the left rail until Activity / Risk has been opened (heavy). */
  const [intelligenceEnabled, setIntelligenceEnabled] = useState(false);
  const [aiAnalysisReport, setAiAnalysisReport] =
    useState<WalletAiAnalysisResponse | null>(null);
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisError, setAiAnalysisError] = useState<string | null>(null);
  const [aiAnalysisWaitingReason, setAiAnalysisWaitingReason] = useState<
    string | null
  >(null);
  const [, setAiAnalysisLastUpdated] = useState<string | null>(null);
  const [isPagePdfExporting, setIsPagePdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [isChartsExporting, setIsChartsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const reportTemplateRef = useRef<HTMLDivElement | null>(null);
  const portfolioLoadedRef = useRef(false);
  const activityLoadedRef = useRef(false);
  const aiAnalysisRequestedRef = useRef(false);
  const aiAnalysisLoadedRef = useRef(false);
  const aiAnalysisRequestIdRef = useRef(0);
  const aiAnalysisCacheRef = useRef<Record<string, WalletAiAnalysisResponse>>(
    {},
  );
  const aiAnalysisInFlightRef = useRef<
    Partial<Record<string, Promise<WalletAiAnalysisResponse | null>>>
  >({});
  /** Reset when leaving Holdings so we can retry portfolio fetch if the table is still empty (chart uses a different API). */
  const holdingsPortfolioAttemptedRef = useRef<string | null>(null);

  const [leftWidth, setLeftWidth] = useState(420);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(420);

  const [selectedToken, setSelectedToken] = useState<{
    address: string;
    symbol: string;
    avgBuyCost: number;
    avgSellCost: number;
  } | null>(null);

  const walletTokenDetails = useGet(
    client.api.wallets[":address"].tokens,
    200,
    { param: { address: address || "" } },
    { enabled: !!address && activeTab === 1 },
  );

  const tokenAddresses = useMemo(
    () =>
      walletTokenDetails.data
        ?.map((details) => details.tokenAddress)
        .join(",") || null,
    [walletTokenDetails.data],
  );

  const tokenMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    {
      enabled: !!tokenAddresses,
      select: (data) =>
        Object.fromEntries(data.map((item) => [item.address, item])),
    },
  );

  const tokenMarket = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: tokenAddresses || "" } },
    { enabled: !!tokenAddresses },
  );

  const handleDividerMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      isDragging.current = true;
      dragStartX.current = event.clientX;
      dragStartWidth.current = leftWidth;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftWidth],
  );

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = event.clientX - dragStartX.current;
      const next = Math.min(700, Math.max(280, dragStartWidth.current + delta));
      setLeftWidth(next);
    };

    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!exportMenuRef.current) return;
      if (!exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };

    if (isExportMenuOpen) {
      document.addEventListener("mousedown", onOutsideClick);
    }

    return () => {
      document.removeEventListener("mousedown", onOutsideClick);
    };
  }, [isExportMenuOpen]);

  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<WalletSwap | null>(null);

  const loadedSwaps = useMemo(() => flattenLoadedPages(swapPages), [swapPages]);
  const loadedTransfers = useMemo(
    () => flattenLoadedPages(transferPages),
    [transferPages],
  );

  const { rows: portfolioData, meta: portfolioMeta } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );
  const portfolioMetaMap = useMemo(
    () => buildPortfolioMetaMap(portfolioMeta),
    [portfolioMeta],
  );
  const portfolioTableData = useMemo(
    () =>
      portfolioData.map((row, rowIndex) => [
        portfolioMeta[rowIndex]?.tokenAddress ?? "",
        ...row,
      ]),
    [portfolioData, portfolioMeta],
  );
  const tokenWatchlistLookup = useMemo(
    () => new Set(tokenWatchlist.map((item) => item.toLowerCase())),
    [tokenWatchlist],
  );
  const formatSwapPair = (swap: WalletSwap): string => {
    const tokensInvolved =
      typeof swap.tokensInvolved === "string"
        ? swap.tokensInvolved
        : String(swap.tokensInvolved ?? "");
    return tokensInvolved.replace(/,/g, " → ");
  };

  const toOptionalFiniteNumber = (value: unknown): number | undefined => {
    if (value == null) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const swapData = useMemo(
    () =>
      loadedSwaps.map((swap) => {
        const totalValueUsd = toOptionalFiniteNumber(swap.totalValueUsd);
        return [
          String(swap.blockTimestampIso ?? ""), // time column
          formatSwapPair(swap), // pair column
          swap.sold, // sold column
          swap.bought, // bought column
          totalValueUsd ?? "—",
        ];
      }),
    [loadedSwaps],
  );

  const swapReportRows = useMemo(
    () =>
      loadedSwaps.map((swap) => [
        fmt.datetime.relativeShort(swap.blockTimestampIso, true),
        formatSwapPair(swap),
        swap.sold?.symbol ? String(swap.sold.symbol).toUpperCase() : "—",
        swap.bought?.symbol ? String(swap.bought.symbol).toUpperCase() : "—",
        swap.totalValueUsd != null ? fmt.num.currency(swap.totalValueUsd) : "—",
      ]),
    [fmt, loadedSwaps],
  );

  const transferData = useMemo(
    () =>
      loadedTransfers.map((transfer) => {
        const tokenMetaLookupAddress = resolveTokenMetaLookupAddress(
          transfer.tokenAddress,
        );
        const fallbackLogoUri = tokenMetaLookupAddress
          ? tokenMeta.data?.[tokenMetaLookupAddress]?.imageUrl
          : undefined;
        const tokenSymbol =
          typeof transfer.tokenSymbol === "string" &&
          transfer.tokenSymbol.trim().length > 0
            ? transfer.tokenSymbol
            : "Unknown";
        const tokenAmount = transfer.amount;
        const transferValueUsd =
          transfer.amountUsd ??
          (transfer.priceUsd != null ? tokenAmount * transfer.priceUsd : null);
        const tokenCell = {
          address: transfer.tokenAddress,
          amount: tokenAmount,
          symbol: tokenSymbol,
          name: transfer.tokenName ?? null,
          logoUri: transfer.tokenLogoUri ?? fallbackLogoUri ?? null,
          priceUsd: transfer.priceUsd ?? 0,
          valueUsd: transferValueUsd ?? 0,
          toString: () => {
            return tokenSymbol;
          },
          valueOf: () => {
            return tokenAmount;
          },
        };

        return [
          transfer.timestamp,
          transfer.from,
          transfer.to,
          tokenCell,
          transferValueUsd,
        ];
      }),
    [loadedTransfers],
  );

  const swapHeaders = [
    tr("walletPage.time"),
    tr("walletPage.pair"),
    tr("walletPage.tokenSold"),
    tr("walletPage.tokenBought"),
    tr("walletPage.value"),
  ];

  const transferHeaders = [
    tr("walletPage.time"),
    tr("walletPage.sender"),
    tr("walletPage.receiver"),
    tr("walletPage.token"),
    tr("walletPage.value"),
  ];

  const portfolioHeaders = [
    { header: "", align: "center" as const, minWidth: "3.25rem" },
    {
      header: tr("walletPage.token"),
      align: "start" as const,
      minWidth: "11rem",
    },
    { header: tr("walletPage.price"), align: "end" as const, minWidth: "8rem" },
    {
      header: tr("walletPage.holding"),
      align: "end" as const,
      minWidth: "8rem",
    },
    {
      header: tr("walletPage.value"),
      align: "end" as const,
      minWidth: "8.5rem",
    },
  ];

  const isSortablePortfolio = [false, false, true, true, true];
  const isSortableSwaps = [true, false, true, true, true];
  const isSortableTransfers = [true, false, false, true, true];

  const swapSortConfigs = {
    0: { type: SortType.Date },
    2: { type: SortType.Number, field: "amount" },
    3: { type: SortType.Number, field: "amount" },
    4: { type: SortType.Number },
  };
  const transferSortConfigs = {
    0: { type: SortType.Date },
    2: { type: SortType.Number },
    4: { type: SortType.Number },
  };
  const portfolioSortConfig = {
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  const renderSwapTokenInfoClassnames = {
    container: styles.swapTokenCell,
    amount: styles.swapTokenAmount,
  };
  const swapCellRenderers = [
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    (value: string, row?: any[]) => {
      const soldToken = Array.isArray(row)
        ? (row[2] as WalletSwapTokenChange | undefined)
        : undefined;
      const boughtToken = Array.isArray(row)
        ? (row[3] as WalletSwapTokenChange | undefined)
        : undefined;
      const soldSymbol = soldToken?.symbol
        ? String(soldToken.symbol).toUpperCase()
        : "UNK";
      const boughtSymbol = boughtToken?.symbol
        ? String(boughtToken.symbol).toUpperCase()
        : "UNK";
      const pairLabel = String(value || "").replace(/,/g, " → ");

      return (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
          }}
        >
          <span
            style={{
              position: "relative",
              width: 30,
              height: 30,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 999,
                overflow: "hidden",
                boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.45)",
              }}
            >
              <TknImg
                src={soldToken?.logoUri ?? null}
                alt={soldToken?.name ?? soldSymbol}
                size={30}
              />
            </span>
            <span
              style={{
                position: "absolute",
                right: -2,
                bottom: -2,
                borderRadius: 999,
                overflow: "hidden",
                boxShadow: "0 0 0 2px var(--cds-layer, #fff)",
              }}
            >
              <TknImg
                src={boughtToken?.logoUri ?? null}
                alt={boughtToken?.name ?? boughtSymbol}
                size={14}
              />
            </span>
          </span>
          <span
            style={{
              display: "inline-flex",
              flexDirection: "column",
              minWidth: 0,
              lineHeight: 1.2,
            }}
          >
            <span style={{ color: "var(--cds-text-primary)" }}>
              {pairLabel}
            </span>
          </span>
        </span>
      );
    },
    (value: WalletSwapTokenInfo, row?: any) => {
      if (!value || typeof value !== "object") return renderCode(String(value));
      const token = value;
      return renderTokenCell(
        token,
        fmt.num.compact.decimal,
        renderSwapTokenInfoClassnames,
        30,
        true,
        "negative",
      )(String(token.symbol ?? ""), row ?? null);
    },
    (value: WalletSwapTokenInfo, row?: any) => {
      if (!value || typeof value !== "object") return renderCode(String(value));
      const token = value;
      return renderTokenCell(
        token,
        fmt.num.compact.decimal,
        renderSwapTokenInfoClassnames,
        30,
        true,
        "positive",
      )(String(token.symbol ?? ""), row ?? null);
    },
    (value: number | string) => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return renderBase(fmt.num.currency(value));
      }
      return renderBase(String(value));
    },
  ];

  const transferCellRenderers = [
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    (value: string) => {
      const isCurrentWallet = value === walletAddress;
      return renderHash(
        value,
        6,
        4,
        isCurrentWallet ? <User size={12} /> : undefined,
        isCurrentWallet ? tr("walletPage.currentWallet") : undefined,
      );
    },
    (value: string) => {
      const isCurrentWallet = value === walletAddress;
      return renderHash(
        value,
        6,
        4,
        isCurrentWallet ? <User size={12} /> : undefined,
        isCurrentWallet ? tr("walletPage.currentWallet") : undefined,
      );
    },
    (value: WalletSwapTokenInfo, row?: any) => {
      // neccessary evil
      return renderTokenCell(
        value,
        fmt.num.compact.decimal,
        renderSwapTokenInfoClassnames,
        30,
        true,
      )(String(value.symbol ?? ""), row);
    },
    (value: number | null) => {
      if (value == null) return renderBase("—");
      return renderBase(fmt.num.currency(value));
    },
  ];

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

      if (!tokenAddress) {
        return null;
      }

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
      const fallbackLogoUri = tokenMetaLookupAddress
        ? tokenMeta.data?.[tokenMetaLookupAddress]?.imageUrl
        : undefined;
      return (
        <TokenIdentityCell
          symbol={value}
          fullName={portfolioTokenMeta?.fullName}
          imageUrl={portfolioTokenMeta?.logoUri ?? fallbackLogoUri}
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

  const portfolioFilterSchema: Record<number, FilterConfig | null> = {
    1: { type: FilterType.Select },
    2: { type: FilterType.Range, min: 0, max: 500, step: 0.01 },
    3: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.001 },
    4: { type: FilterType.Range, min: 0, max: 100_000, step: 0.01 },
  };

  const swapFilterSchema: Record<number, FilterConfig | null> = {
    0: { type: FilterType.Date },
    1: {
      type: FilterType.Composite,
      filters: {
        name: { type: FilterType.Select, field: "name" },
        logo: null,
      },
    },
    2: {
      type: FilterType.Composite,
      filters: {
        address: null,
        amount: {
          type: FilterType.Range,
          field: "amount",
          min: 0,
          max: 10_000,
          step: 0.01,
        },
        symbol: { type: FilterType.Select, field: "symbol" },
        name: { type: FilterType.Select, field: "name" },
        logoUri: null,
        priceUsd: null,
        valueUsd: null,
      },
    },
    3: {
      type: FilterType.Composite,
      filters: {
        address: null,
        amount: {
          type: FilterType.Range,
          field: "amount",
          min: 0,
          max: 10_000,
          step: 0.01,
        },
        symbol: { type: FilterType.Select, field: "symbol" },
        name: { type: FilterType.Select, field: "name" },
        logoUri: null,
        priceUsd: null,
        valueUsd: null,
      },
    },
    4: {
      type: FilterType.Range,
      min: 0,
      max: 1_000_000,
      step: 0.01,
    },
  };

  const transferFilterSchema: Record<number, FilterConfig | null> = {
    0: { type: FilterType.Date },
    1: { type: FilterType.Select },
    2: { type: FilterType.Select },
    3: {
      type: FilterType.Composite,
      filters: {
        symbol: { type: FilterType.Select, field: "symbol" },
        name: { type: FilterType.Select, field: "name" },
        amount: {
          type: FilterType.Range,
          field: "amount",
          min: 0,
          max: 10_000,
          step: 0.01,
        },
        logoUri: null,
        address: null,
        priceUsd: null,
        valueUsd: null,
      },
    },
    4: {
      type: FilterType.Range,
      min: 0,
      max: 1_000_000,
      step: 0.01,
    },
  };

  // const handleSwapPageChange = async (): Promise<boolean> => {
  //   if (!address || swapLoading) return false;
  //   const maxLoadedPage = getMaxLoadedPage(swapPages);
  //   if (maxLoadedPage < 1) return false;
  //   const previousPageInfo = swapPageInfoByPage[maxLoadedPage];
  //   if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor)
  //     return false;
  //   setSwapLoading(true);
  //   try {
  //     const response = await fetchWalletSwaps(address, {
  //       cursor: previousPageInfo.nextCursor,
  //       before: previousPageInfo.nextCursor,
  //     });
  //     const nextRows = Array.isArray(response.swaps) ? response.swaps : [];
  //     const nextPage = maxLoadedPage + 1;
  //     setSwapPages((prev) => ({ ...prev, [nextPage]: nextRows }));
  //     setSwapPageInfoByPage((prev) => ({
  //       ...prev,
  //       [nextPage]: response.pageInfo,
  //     }));
  //     return nextRows.length > 0;
  //   } catch (error) {
  //     console.error("Failed to load wallet swap page", error);
  //     return false;
  //   } finally {
  //     setSwapLoading(false);
  //   }
  // };

  // const handleTransferPageChange = async (): Promise<boolean> => {
  //   if (!address || transferLoading) return false;
  //   const maxLoadedPage = getMaxLoadedPage(transferPages);
  //   if (maxLoadedPage < 1) return false;
  //   const previousPageInfo = transferPageInfoByPage[maxLoadedPage];
  //   if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor)
  //     return false;
  //   setTransferLoading(true);
  //   try {
  //     const response = await fetchWalletTransfers(address, {
  //       cursor: previousPageInfo.nextCursor,
  //     });
  //     const nextRows = Array.isArray(response.transfers)
  //       ? response.transfers
  //       : [];
  //     const nextPage = maxLoadedPage + 1;
  //     setTransferPages((prev) => ({ ...prev, [nextPage]: nextRows }));
  //     setTransferPageInfoByPage((prev) => ({
  //       ...prev,
  //       [nextPage]: response.pageInfo,
  //     }));
  //     return nextRows.length > 0;
  //   } catch (error) {
  //     console.error("Failed to load wallet transfer page", error);
  //     return false;
  //   } finally {
  //     setTransferLoading(false);
  //   }
  // };

  useEffect(() => {
    if (!user || !address || address === "null") {
      setWalletTags([]);
      return;
    }

    fetchWalletTags(address)
      .then(setWalletTags)
      .catch((error) => {
        console.error("[WalletPage] Failed to load wallet tags:", error);
        setWalletTags([]);
      });
  }, [address, user]);

  const loadPortfolioData = useCallback(async (): Promise<
    WalletPortfolioItem[]
  > => {
    if (!address || address === "null") {
      return [];
    }
    setPortfolioLoading(true);
    try {
      const portfolioResult = await fetchWalletPortfolio(address);
      const rows = Array.isArray(portfolioResult) ? portfolioResult : [];
      flushSync(() => {
        setPortfolio(rows);
      });
      return rows;
    } catch (error) {
      console.error("[WalletPage] Failed to load portfolio", error);
      flushSync(() => {
        setPortfolio([]);
      });
      portfolioLoadedRef.current = false;
      return [];
    } finally {
      setPortfolioLoading(false);
    }
  }, [address]);

  const loadActivityData = useCallback(async (): Promise<{
    swaps: WalletSwap[];
    transfers: WalletTransfer[];
  }> => {
    if (!address || address === "null") {
      return { swaps: [], transfers: [] };
    }
    setSwapLoading(true);
    setTransferLoading(true);
    try {
      const [swapsResult, transfersResult] = await Promise.allSettled([
        fetchWalletSwaps(address),
        fetchWalletTransfers(address),
      ]);

      let swaps: WalletSwap[] = [];
      let transfers: WalletTransfer[] = [];

      if (swapsResult.status === "fulfilled") {
        const swapsData = swapsResult.value?.swaps || [];
        if (Array.isArray(swapsData)) {
          swaps = swapsData;
        }
      }

      if (transfersResult.status === "fulfilled") {
        const transfersData = transfersResult.value?.transfers || [];
        if (Array.isArray(transfersData)) {
          transfers = transfersData;
        }
      }

      flushSync(() => {
        if (swapsResult.status === "fulfilled") {
          setSwapPages({ 1: swaps });
          setSwapPageInfoByPage({ 1: swapsResult.value.pageInfo });
        }

        if (transfersResult.status === "fulfilled") {
          setTransferPages({ 1: transfers });
          setTransferPageInfoByPage({ 1: transfersResult.value.pageInfo });
        }
      });

      return { swaps, transfers };
    } catch (error) {
      console.error("[WalletPage] Failed to load activity data", error);
      return { swaps: [], transfers: [] };
    } finally {
      setSwapLoading(false);
      setTransferLoading(false);
    }
  }, [address]);

  const loadAiAnalysisData = useCallback(
    async (forceRefresh = false): Promise<WalletAiAnalysisResponse | null> => {
      if (!address || address === "null") {
        return null;
      }

      const aiAnalysisCacheKey = `${address}:${aiAnalysisLanguage}`;

      if (!forceRefresh && aiAnalysisCacheRef.current[aiAnalysisCacheKey]) {
        const cached = aiAnalysisCacheRef.current[aiAnalysisCacheKey];
        setAiAnalysisReport(cached);
        setAiAnalysisError(null);
        setAiAnalysisWaitingReason(null);
        aiAnalysisLoadedRef.current = true;
        return cached;
      }

      if (aiAnalysisInFlightRef.current[aiAnalysisCacheKey]) {
        return aiAnalysisInFlightRef.current[aiAnalysisCacheKey];
      }

      const requestId = ++aiAnalysisRequestIdRef.current;
      const run = (async () => {
        setAiAnalysisLoading(true);
        setAiAnalysisError(null);
        setAiAnalysisWaitingReason(null);

        try {
          let intelligence = intelligenceReport ?? null;
          if (!intelligence) {
            setIntelligenceLoading(true);
            try {
              intelligence = await fetchWalletIntelligence(address);
              if (!intelligenceReport) {
                setIntelligenceReport(intelligence ?? null);
              }
            } finally {
              setIntelligenceLoading(false);
            }
          }

          let portfolioRows = portfolio;
          if (!portfolioLoadedRef.current) {
            portfolioRows = await loadPortfolioData();
          }

          let activitySwaps = loadedSwaps;
          if (!activityLoadedRef.current) {
            const activity = await loadActivityData();
            activitySwaps = activity.swaps;
          }

          const missingDependencies: string[] = [];

          if (intelligence?.identity?.status === "unavailable") {
            missingDependencies.push("identity");
          }

          if (!intelligence?.analysis?.firstFund) {
            missingDependencies.push("first_fund");
          }

          if (!Array.isArray(portfolioRows) || portfolioRows.length === 0) {
            missingDependencies.push("portfolio");
          }

          if (!Array.isArray(activitySwaps) || activitySwaps.length === 0) {
            missingDependencies.push("swaps");
          }

          if (missingDependencies.length > 0) {
            if (requestId === aiAnalysisRequestIdRef.current) {
              setAiAnalysisReport(null);
              setAiAnalysisWaitingReason(
                `AI analysis waiting for dependencies: ${missingDependencies.join(", ")}`,
              );
            }
            return null;
          }

          const response = await fetchWalletAiAnalysis(
            address,
            aiAnalysisLanguage,
          );
          if (requestId !== aiAnalysisRequestIdRef.current) {
            return null;
          }

          aiAnalysisCacheRef.current[aiAnalysisCacheKey] = response;
          setAiAnalysisReport(response);
          setAiAnalysisLastUpdated(new Date().toISOString());
          aiAnalysisLoadedRef.current = true;
          return response;
        } catch (error) {
          if (requestId !== aiAnalysisRequestIdRef.current) {
            return null;
          }

          aiAnalysisLoadedRef.current = false;
          setAiAnalysisReport(null);
          setAiAnalysisError(
            error instanceof Error
              ? error.message
              : tr("walletPage.aiAnalysisFailed"),
          );
          return null;
        } finally {
          delete aiAnalysisInFlightRef.current[aiAnalysisCacheKey];
          if (requestId === aiAnalysisRequestIdRef.current) {
            setAiAnalysisLoading(false);
          }
        }
      })();

      aiAnalysisInFlightRef.current[aiAnalysisCacheKey] = run;
      return run;
    },
    [
      address,
      intelligenceReport,
      intelligenceLoading,
      portfolio,
      loadedSwaps,
      loadActivityData,
      loadPortfolioData,
      aiAnalysisLanguage,
      tr,
    ],
  );

  useEffect(() => {
    setIntelligenceEnabled(false);
  }, [address]);

  useEffect(() => {
    aiAnalysisRequestIdRef.current += 1;
    aiAnalysisRequestedRef.current = false;
    aiAnalysisLoadedRef.current = false;
    setAiAnalysisReport(null);
    setAiAnalysisError(null);
    setAiAnalysisWaitingReason(null);
    setAiAnalysisLastUpdated(null);
    setAiAnalysisLoading(false);
  }, [address, aiAnalysisLanguage]);

  useEffect(() => {
    if (activeTab === 2) {
      setIntelligenceEnabled(true);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 4 && !aiAnalysisRequestedRef.current) {
      aiAnalysisRequestedRef.current = true;
      void loadAiAnalysisData();
    }
  }, [activeTab, loadAiAnalysisData]);

  useEffect(() => {
    if (activeTab !== 1) {
      holdingsPortfolioAttemptedRef.current = null;
    }
  }, [activeTab]);

  useEffect(() => {
    if (!address || address === "null") {
      portfolioLoadedRef.current = false;
      activityLoadedRef.current = false;
      holdingsPortfolioAttemptedRef.current = null;
      setPortfolio([]);
      setSwapPages({});
      setSwapPageInfoByPage({});
      setTransferPages({});
      setTransferPageInfoByPage({});
      setOverviewReport(null);
      setIntelligenceReport(null);
      setAiAnalysisReport(null);
      setAiAnalysisError(null);
      setAiAnalysisWaitingReason(null);
      setAiAnalysisLastUpdated(null);
      setAiAnalysisLoading(false);
      return;
    }
    portfolioLoadedRef.current = false;
    activityLoadedRef.current = false;
    aiAnalysisLoadedRef.current = false;
  }, [address]);

  useEffect(() => {
    if (!address || address === "null") {
      return;
    }

    const shouldInitialPortfolioLoad =
      (activeTab === 0 || activeTab === 1) && !portfolioLoadedRef.current;
    const shouldHoldingsPortfolioBackfill =
      activeTab === 1 &&
      portfolioLoadedRef.current &&
      portfolio.length === 0 &&
      !portfolioLoading &&
      holdingsPortfolioAttemptedRef.current !== address;

    if (shouldInitialPortfolioLoad) {
      portfolioLoadedRef.current = true;
      void loadPortfolioData();
    } else if (shouldHoldingsPortfolioBackfill) {
      holdingsPortfolioAttemptedRef.current = address;
      void loadPortfolioData();
    }

    if (activeTab === 2 && !activityLoadedRef.current) {
      activityLoadedRef.current = true;
      void loadActivityData();
    }
  }, [
    address,
    activeTab,
    portfolio.length,
    portfolioLoading,
    loadPortfolioData,
    loadActivityData,
  ]);

  const ensurePortfolioAndActivityForExport = useCallback(async (): Promise<{
    portfolio: WalletPortfolioItem[];
    swaps: WalletSwap[];
    transfers: WalletTransfer[];
  }> => {
    if (!address || address === "null") {
      return { portfolio: [], swaps: [], transfers: [] };
    }

    let p = portfolio;
    if (!portfolioLoadedRef.current) {
      portfolioLoadedRef.current = true;
      p = await loadPortfolioData();
    }

    let s = loadedSwaps;
    let t = loadedTransfers;
    if (!activityLoadedRef.current) {
      activityLoadedRef.current = true;
      const activity = await loadActivityData();
      s = activity.swaps;
      t = activity.transfers;
    }

    return { portfolio: p, swaps: s, transfers: t };
  }, [
    address,
    portfolio,
    loadedSwaps,
    loadedTransfers,
    loadPortfolioData,
    loadActivityData,
  ]);

  const activeReportSection = useMemo<WalletReportSection>(() => {
    if (activeTab === 1) {
      return "holdings";
    }
    if (activeTab === 2) {
      return "activity_risk";
    }
    return "overview";
  }, [activeTab]);

  const reportHeaderTags = useMemo(() => {
    const tags: string[] = [];

    const identityCategory =
      intelligenceReport?.identity?.status === "known"
        ? intelligenceReport.identity.category
        : null;
    if (
      typeof identityCategory === "string" &&
      identityCategory.trim().length > 0
    ) {
      tags.push(identityCategory.trim());
    }

    const firstFund = intelligenceReport?.analysis?.firstFund ?? null;
    const firstFunderLabel =
      firstFund?.funderLabel ?? firstFund?.funderAddress ?? null;
    if (firstFund?.funderAddress && firstFunderLabel) {
      tags.push(`${tr("walletPage.firstFunderTag")}: ${firstFunderLabel}`);
    }

    const walletAgeLabel = firstFund?.walletAgeLabel ?? null;
    if (walletAgeLabel) {
      tags.push(`${tr("walletPage.walletAgeTag")}: ${walletAgeLabel}`);
    }

    if (walletTags.length > 0) {
      tags.push(...walletTags);
    }

    return Array.from(new Set(tags));
  }, [intelligenceReport, walletTags, tr]);

  const reportDate = useMemo(() => new Date(), []);

  const { exportReportAsPdf } = useExportReport({
    filenameBase: `wallet-report-${address?.slice(0, 8) || "overview"}`,
    reportRef: reportTemplateRef,
  });

  async function handleExportPagePdf() {
    if (isPagePdfExporting || !address || address === "null") return;
    setIsPagePdfExporting(true);
    setIsExportMenuOpen(false);
    try {
      await ensurePortfolioAndActivityForExport();
      const [ov, intel] = await Promise.all([
        fetchWalletOverview(address, "solana"),
        fetchWalletIntelligence(address, "solana"),
      ]);
      flushSync(() => {
        setOverviewReport(ov ?? null);
        setIntelligenceReport(intel ?? null);
      });
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await exportReportAsPdf();
    } catch (error) {
      console.error("[WalletPage] Failed to export page PDF:", error);
    } finally {
      setIsPagePdfExporting(false);
    }
  }

  async function handleExportDataXlsx() {
    try {
      setIsDataExporting(true);
      const snap = await ensurePortfolioAndActivityForExport();
      const { rows: portfolioRows } = mapPortfolioItems(snap.portfolio);
      const swapSheetRows = snap.swaps.map((swap) => {
        const totalValueUsd = toOptionalFiniteNumber(swap.totalValueUsd);
        const baseQuotePrice = toOptionalFiniteNumber(swap.baseQuotePrice);
        return [
          String(swap.blockTimestampIso ?? ""),
          formatSwapPair(swap),
          swap.sold,
          swap.bought,
          totalValueUsd ?? "—",
          baseQuotePrice ?? "—",
          swap.transactionHash,
        ];
      });
      const transferSheetRows = snap.transfers.map((transfer) => [
        fmt.datetime.relativeShort(transfer.timestamp, true),
        transfer.from,
        transfer.to,
        `${
          typeof transfer.tokenSymbol === "string" &&
          transfer.tokenSymbol.trim().length > 0
            ? transfer.tokenSymbol
            : "Unknown"
        } (${fmt.num.decimal(transfer.amount)})`,
        transfer.amountUsd != null ? fmt.num.currency(transfer.amountUsd) : "—",
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([swapHeaders, ...swapSheetRows]),
        "Swaps",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([transferHeaders, ...transferSheetRows]),
        "Transfers",
      );
      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.aoa_to_sheet([
          portfolioHeaders.slice(1).map(tableHeaderLabel),
          ...portfolioRows,
        ]),
        "Portfolio",
      );
      const filename = `wallet-data-${address?.slice(0, 8) || "overview"}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("[WalletPage] Failed to export XLSX:", error);
      window.alert(tr("walletPage.exportXlsxFailed"));
    } finally {
      setIsDataExporting(false);
      setIsExportMenuOpen(false);
    }
  }

  async function handleExportChartsZip() {
    try {
      setIsChartsExporting(true);
      const root = document.querySelector(`.${styles.rightContent}`);
      if (!root) throw new Error("Chart container not found");
      const zip = new JSZip();
      const imagesFolder = zip.folder("charts");
      if (!imagesFolder) throw new Error("Unable to create ZIP folder");
      const canvases = Array.from(root.querySelectorAll("canvas"));
      if (canvases.length === 0)
        throw new Error("No chart images found to export");

      await Promise.all(
        canvases.map(async (canvas, index) => {
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png"),
          );
          if (blob) imagesFolder.file(`chart-${index + 1}.png`, blob);
        }),
      );

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wallet-charts-${address?.slice(0, 8) || "overview"}-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("[WalletPage] Failed to export charts ZIP:", error);
      window.alert(tr("walletPage.exportZipFailed"));
    } finally {
      setIsChartsExporting(false);
      setIsExportMenuOpen(false);
    }
  }

  const overviewTab = (
    <div className={styles.tabPane}>
      <PageSection>
        <div className={styles.chartStack}>
          <div className={styles.chartSection}>
            <BalanceChartV2 address={walletAddress} />
          </div>
          <div className={styles.chartSection}>
            <PnLChart
              minHeight={400}
              autoRefresh
              initialFilters={{ wallets: [walletAddress] }}
            />
          </div>
        </div>
      </PageSection>
    </div>
  );

  const holdingsTab = (
    <div className={styles.tabPane}>
      <PageSection>
        <div className={styles.sectionStack}>
          <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
            <div
              className={styles.chartSection}
              style={{ flex: "0 1 48%", minWidth: 0 }}
            >
              <AssetDistribution
                initialFilters={{
                  wallets: address ? [address] : [],
                  timePeriod: "30D",
                }}
                autoRefresh
              />
            </div>
            <div
              className={`${styles.chartSection} ${styles.portfolioCard}`}
              style={{ flex: "1 1 52%", minWidth: 280 }}
            >
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
                onRowClick={(_row, rowIndex) => {
                  const tokenAddress =
                    rowIndex >= 0
                      ? portfolioMeta[rowIndex]?.tokenAddress
                      : undefined;
                  if (tokenAddress) {
                    navigate(`/tokens/${tokenAddress}`);
                  }
                }}
                loading={portfolioLoading && portfolioTableData.length === 0}
              />
            </div>
          </div>
          <div className={styles.chartSection}>
            <TokenDetailsDemo setSelectedToken={setSelectedToken} />
          </div>
        </div>
      </PageSection>
    </div>
  );

  const activityTab = (
    <div className={styles.tabPane}>
      <PageSection>
        <div className={styles.tableStack}>
          <div className={styles.chartSection}>
            <Table
              maxHeight={400}
              title={tr("walletPage.swap")}
              headers={swapHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(swapData)}
              filterSchema={swapFilterSchema}
              cellRenderers={swapCellRenderers}
              dataEntries={swapData}
              isSortable={isSortableSwaps}
              sortConfigs={swapSortConfigs}
              onRowClick={(_row, rowIndex) => {
                const swap = loadedSwaps[rowIndex >= 0 ? rowIndex : -1];
                if (swap) {
                  setSelectedSwap(swap);
                  setSwapModalOpen(true);
                }
              }}
              loading={swapLoading && loadedSwaps.length === 0}
              // serverPagination={{
              //   enabled: true,
              //   hasMore: swapHasMore,
              //   isLoading: swapLoading,
              //   onPageChange: handleSwapPageChange,
              // }}
            />
          </div>
          <div className={styles.chartSection}>
            <Table
              maxHeight={400}
              title={tr("walletPage.transfer")}
              headers={transferHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(transferData)}
              filterSchema={transferFilterSchema}
              cellRenderers={transferCellRenderers}
              dataEntries={transferData}
              isSortable={isSortableTransfers}
              sortConfigs={transferSortConfigs}
              loading={transferLoading && loadedTransfers.length === 0}
              // serverPagination={{
              //   enabled: true,
              //   hasMore: transferHasMore,
              //   isLoading: transferLoading,
              //   onPageChange: handleTransferPageChange,
              // }}
            />
          </div>
        </div>
      </PageSection>
    </div>
  );

  const auditTab = (
    <div className={styles.tabPane}>
      <PageSection>
        <WalletAuditPanel
          walletAddress={walletAddress}
          enabled={activeTab === 3}
        />
      </PageSection>
    </div>
  );

  const aiAnalysisTab = (
    <div className={styles.tabPane}>
      <PageSection>
        <AiAnalysisTab
          aiAnalysisLoading={aiAnalysisLoading}
          aiAnalysisError={aiAnalysisError}
          aiAnalysisWaitingReason={aiAnalysisWaitingReason}
          aiAnalysisReport={aiAnalysisReport}
          aiAnalysisLastUpdated={
            null
            // aiAnalysisLastUpdated
            //   ? fmt.datetime.relativeShort(aiAnalysisLastUpdated, true)
            //   : null
          }
          dependencyItems={((): AiAnalysisDependencyItem[] => {
            const portfolioAvailable =
              Array.isArray(portfolio) && portfolio.length > 0;
            const swapsAvailable =
              Array.isArray(loadedSwaps) && loadedSwaps.length > 0;
            const intelligenceAvailable = intelligenceReport != null;

            const portfolioStatus: AiAnalysisDependencyItem["status"] =
              portfolioAvailable
                ? "available"
                : portfolioLoading
                  ? "fetching"
                  : "no_data";

            const swapsStatus: AiAnalysisDependencyItem["status"] =
              swapsAvailable
                ? "available"
                : swapLoading
                  ? "fetching"
                  : "no_data";

            const intelligenceStatus: AiAnalysisDependencyItem["status"] =
              intelligenceAvailable
                ? "available"
                : intelligenceLoading ||
                    (intelligenceEnabled && intelligenceReport == null)
                  ? "fetching"
                  : "no_data";

            return [
              {
                id: "portfolio",
                label: String(tr("walletPage.aiDataPortfolio")),
                status: portfolioStatus,
              },
              {
                id: "swaps",
                label: String(tr("walletPage.aiDataSwaps")),
                status: swapsStatus,
              },
              {
                id: "intelligence",
                label: String(tr("walletPage.aiDataIntelligence")),
                status: intelligenceStatus,
              },
            ];
          })()}
          canGenerate={
            Array.isArray(portfolio) &&
            portfolio.length > 0 &&
            Array.isArray(loadedSwaps) &&
            loadedSwaps.length > 0 &&
            intelligenceReport != null
          }
          onGenerate={() => {
            aiAnalysisRequestedRef.current = true;
            void loadAiAnalysisData(true);
          }}
          onRetry={() => {
            aiAnalysisRequestedRef.current = true;
            void loadAiAnalysisData(true);
          }}
        />
      </PageSection>
    </div>
  );

  const pdfPageStyle: React.CSSProperties = {
    width: 1024,
    background: "#ffffff",
    color: "#0f172a",
    padding: 32,
    boxSizing: "border-box",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  };

  const pdfCardStyle: React.CSSProperties = {
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    background: "#ffffff",
    overflow: "hidden",
    marginBottom: 20,
  };

  const renderPdfHeader = (pageTitle: string) => (
    <header
      style={{
        borderBottom: "1px solid #e2e8f0",
        paddingBottom: 16,
        marginBottom: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.2 }}>
            Wallet Audit Report
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#475569" }}>
            Export Date: {reportDate.toLocaleDateString("en-GB")}
          </p>
        </div>
        <div
          style={{
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Wallet Address
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4 }}>
            {walletAddress}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {reportHeaderTags.length > 0 ? (
          reportHeaderTags.map((tag) => (
            <span
              key={tag}
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: 999,
                padding: "4px 10px",
                fontSize: 12,
                color: "#1e293b",
                background: "#f8fafc",
              }}
            >
              {tag}
            </span>
          ))
        ) : (
          <span style={{ fontSize: 12, color: "#64748b" }}>No Tags</span>
        )}
      </div>

      <div style={{ marginTop: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20 }}>{pageTitle}</h2>
      </div>
    </header>
  );

  const PrintableTable = ({
    title,
    headers,
    rows,
  }: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }) => (
    <section style={pdfCardStyle}>
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{title}</h3>
      </div>
      <div style={{ padding: 12 }}>
        {rows.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              fontSize: 11,
            }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9" }}>
                {headers.map((header) => (
                  <th
                    key={header}
                    style={{
                      borderBottom: "1px solid #cbd5e1",
                      padding: "8px 6px",
                      textAlign: "left",
                      verticalAlign: "top",
                      wordBreak: "break-word",
                      whiteSpace: "normal",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${title}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${rowIndex}-${cellIndex}`}
                      style={{
                        borderBottom: "1px solid #e2e8f0",
                        padding: "8px 6px",
                        verticalAlign: "top",
                        wordBreak: "break-word",
                        whiteSpace: "normal",
                      }}
                    >
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div
            style={{
              minHeight: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
            }}
          >
            No data available
          </div>
        )}
      </div>
    </section>
  );

  const ChunkedPdfPages = <T,>({
    items,
    chunkSize,
    renderChunk,
  }: {
    items: T[];
    chunkSize: number;
    renderChunk: (
      chunk: T[],
      chunkIndex: number,
      chunkCount: number,
    ) => ReactNode;
  }) => {
    const chunks = useMemo(() => {
      const chunkedItems = chunkArray(items, chunkSize);
      return chunkedItems.length > 0 ? chunkedItems : [[] as T[]];
    }, [items, chunkSize]);

    return (
      <>
        {chunks.map((chunk, chunkIndex) =>
          renderChunk(chunk, chunkIndex, chunks.length),
        )}
      </>
    );
  };

  const activityRiskPdfContent = (
    <>
      <div data-report-page="true" style={pdfPageStyle}>
        {renderPdfHeader("Activity / Risk")}
        <section style={pdfCardStyle}>
          <div
            style={{
              padding: "12px 14px",
              borderBottom: "1px solid #e2e8f0",
              background: "#f8fafc",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              Counterparty Activity Analysis
            </h3>
          </div>
          <div
            style={{
              padding: 12,
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          ></div>
        </section>
      </div>

      <ChunkedPdfPages
        items={swapReportRows}
        chunkSize={PDF_TABLE_ROWS_PER_PAGE}
        renderChunk={(chunkRows, chunkIndex, chunkCount) => (
          <div
            key={`swap-pdf-page-${chunkIndex}`}
            data-report-page="true"
            style={pdfPageStyle}
            className={`${PDF_CHUNK_PAGE_BASE_CLASS} ${chunkIndex < chunkCount - 1 ? PDF_CHUNK_PAGE_BREAK_CLASS : ""}`.trim()}
          >
            {renderPdfHeader("Activity / Risk")}
            <PrintableTable
              title={
                chunkCount > 1
                  ? `Swap (${chunkIndex + 1}/${chunkCount})`
                  : "Swap"
              }
              headers={swapHeaders}
              rows={chunkRows}
            />
          </div>
        )}
      />

      <ChunkedPdfPages
        items={loadedTransfers.map((transfer) => [
          fmt.datetime.relativeShort(transfer.timestamp, true),
          transfer.from,
          transfer.to,
          `${
            typeof transfer.tokenSymbol === "string" &&
            transfer.tokenSymbol.trim().length > 0
              ? transfer.tokenSymbol
              : "Unknown"
          } (${fmt.num.decimal(transfer.amount)})`,
        ])}
        chunkSize={PDF_TABLE_ROWS_PER_PAGE}
        renderChunk={(chunkRows, chunkIndex, chunkCount) => (
          <div
            key={`transfer-pdf-page-${chunkIndex}`}
            data-report-page="true"
            style={pdfPageStyle}
            className={`${PDF_CHUNK_PAGE_BASE_CLASS} ${chunkIndex < chunkCount - 1 ? PDF_CHUNK_PAGE_BREAK_CLASS : ""}`.trim()}
          >
            {renderPdfHeader("Activity / Risk")}
            <PrintableTable
              title={
                chunkCount > 1
                  ? `Transfer (${chunkIndex + 1}/${chunkCount})`
                  : "Transfer"
              }
              headers={transferHeaders}
              rows={chunkRows}
            />
          </div>
        )}
      />
    </>
  );

  const tabActions = (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
        <Button
          size="sm"
          kind="secondary"
          renderIcon={ChevronDown}
          onClick={() => setIsExportMenuOpen((prev) => !prev)}
          disabled={isPagePdfExporting || isDataExporting || isChartsExporting}
        >
          {tr("charts.export")}
        </Button>
        {isExportMenuOpen && (
          <div className={styles.exportMenu}>
            <button
              type="button"
              className={styles.exportMenuItem}
              onClick={handleExportDataXlsx}
              disabled={isDataExporting}
            >
              <Download size={16} />
              {isDataExporting
                ? tr("walletPage.exportingData")
                : tr("walletPage.exportDataXlsx")}
            </button>
            <button
              type="button"
              className={styles.exportMenuItem}
              onClick={handleExportChartsZip}
              disabled={isChartsExporting}
            >
              <Download size={16} />
              {isChartsExporting
                ? tr("walletPage.exportingCharts")
                : tr("walletPage.exportChartsZip")}
            </button>
            <button
              type="button"
              className={styles.exportMenuItem}
              onClick={handleExportPagePdf}
              disabled={isPagePdfExporting}
            >
              <Download size={16} />
              {isPagePdfExporting
                ? tr("walletPage.exportingReport")
                : tr("walletPage.exportReportPdf")}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!address) {
    return (
      <PageWrapper>
        <div>{tr("walletPage.addressNotFound")}</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      noMarketTickers
      extraHeaderPanel={{
        isOpen: !!selectedToken,
        content: selectedToken && (
          <TokenAverageTradePrice
            walletAddress={address}
            tokenAddress={selectedToken.address}
            tokenImgUrl={
              tokenMeta.data?.[selectedToken.address]?.imageUrl || null
            }
            tokenName={tokenMeta.data?.[selectedToken.address]?.name || null}
            tokenSymbol={
              tokenMeta.data?.[selectedToken.address]?.symbol || null
            }
            tokenCurrentPrice={
              tokenMarket.data?.[selectedToken.address]?.priceUsd || null
            }
            avgBuyPrice={selectedToken.avgBuyCost}
            avgSellPrice={selectedToken.avgSellCost}
          />
        ),
        size: "lg",
        onClose: () => setSelectedToken(null),
      }}
    >
      <div
        className={styles.walletGrid}
        style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(0, 1fr)` }}
      >
        <div className={styles.leftColumn}>
          <WalletOverview
            walletAddress={walletAddress}
            enableIntelligence={intelligenceEnabled}
          />
        </div>

        <div
          className={styles.resizeDivider}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={styles.resizeHandle} />
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.rightContent}>
            <TabContainer
              activeTab={activeTab}
              names={[
                tr("walletPage.overview"),
                tr("walletPage.holdings"),
                tr("walletPage.activityRisk"),
                "Forensic Audit",
                tr("walletPage.aiAnalysis"),
              ]}
              tabIcons={[
                <ChartLine key="wallet-overview-icon" size={16} />,
                <Wallet key="wallet-holdings-icon" size={16} />,
                <Activity key="wallet-activity-icon" size={16} />,
                <User key="wallet-audit-icon" size={16} />,
                <AiGenerate key="wallet-ai-analysis-icon" size={16} />,
              ]}
              tabs={[overviewTab, holdingsTab, activityTab, auditTab, aiAnalysisTab]}
              onTabChange={(index) => setActiveTab(index)}
              actions={tabActions}
            />
          </div>
        </div>
      </div>

      <div
        ref={reportTemplateRef}
        className={styles.hiddenReportTemplate}
        aria-hidden="true"
      >
        <WalletReportTemplate
          walletAddress={walletAddress}
          tags={reportHeaderTags}
          overview={overviewReport}
          activeSection={activeReportSection}
          overviewContent={overviewTab}
          holdingsContent={holdingsTab}
          activityRiskContent={activityRiskPdfContent}
          reportDate={reportDate}
        />
      </div>

      <SwapDetailModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        swap={selectedSwap}
      />
    </PageWrapper>
  );
}
