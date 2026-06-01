import client from "@/api/main";
import { PnLChart } from "@/components/charts/PnLChart/index.ts";
import { WalletTopbar } from "@/components/wallet/WalletTopbar/WalletTopbar.tsx";
import { WalletHero } from "@/components/wallet/WalletHero/WalletHero.tsx";
import { WalletHoldingsPanel } from "@/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx";
import { TabContainer } from "@/components/tabContainer/tabContainer.tsx";
import { RightSidebar } from "./RightSidebar.tsx";
import { AiAnalysisModal } from "@/components/wallet/AiAnalysisModal/AiAnalysisModal.tsx";
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
  renderTokenCell,
} from "@/components/tables/TableCellRenderer.tsx";
import { SwapPairCell } from "@/components/wallet/SwapPairCell/SwapPairCell.tsx";
import {
  WalletReportTemplate,
  type WalletReportSection,
} from "@/components/WalletReportTemplate";
import { WalletAuditPanel } from "@/components/wallet/WalletAuditPanel/WalletAuditPanel.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { locale } from "@/config/localization/index.ts";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { useExportReport } from "@/hooks/useExportReport.ts";
import { useGet } from "@/hooks/useGet";
import {
  fetchWalletSwaps,
  fetchWalletTransfers,
  fetchWalletPortfolio,
  fetchWalletOverview,
  fetchWalletIntelligence,
  type WalletSwap,
  type WalletTransfer,
  type WalletPortfolioItem,
  type WalletIntelligenceResponse,
  type WalletOverviewMultiPeriodResponse,
  type WalletPageInfo,
  type WalletSwapTokenChange,
  type WalletSwapTokenInfo,
} from "@/services/wallet/walletApi.ts";
import { fetchWalletTags } from "@/services/wallet/walletTagsApi.ts";
import {
  User,
} from "@carbon/icons-react";
import { Button } from "@carbon/react";
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
import { useParams } from "react-router";
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
import { TransferDetailModal } from "@/components/wallet/TransferDetailModal/TransferDetailModal.tsx";
import { DayActivityPopup } from "@/components/wallet/DayActivityPopup/DayActivityPopup.tsx";
import { AiSwapSummaryModal } from "@/components/wallet/AiSwapSummaryModal";
import { BalanceChartV2 } from "@/components/charts/BalanceChartV2/BalanceChartV2.tsx";
import type { WalletOverviewPeriodKey } from "@/services/wallet/walletApi.ts";
import { TimePeriod } from "@/types/chart-filters.types.ts";

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

export default function WalletPage() {
  const { tr, fmt, lang } = useLocalization();
  const bcp47 = locale[lang].langCode;
  const { address } = useParams<{ address: string }>();
  const walletAddress = address ?? "";

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

  const [selectedPeriod, setSelectedPeriod] = useState<WalletOverviewPeriodKey>("24H");
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [activeActivityTab, setActiveActivityTab] = useState<number>(0);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);

  const [isPagePdfExporting, setIsPagePdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [isChartsExporting, setIsChartsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);
  const reportTemplateRef = useRef<HTMLDivElement | null>(null);

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
    { enabled: !!address },
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

  const [swapModalOpen, setSwapModalOpen] = useState(false);
  const [selectedSwap, setSelectedSwap] = useState<WalletSwap | null>(null);

  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] =
    useState<WalletTransfer | null>(null);

  const [dayPopupOpen, setDayPopupOpen] = useState(false);
  const [dayPopupTimestamp, setDayPopupTimestamp] = useState(0);

  const [aiSwapSummaryOpen, setAiSwapSummaryOpen] = useState(false);

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

  const portfolioMetaAsMap = useMemo(() => {
    const map = new Map<number, { tokenAddress: string; logoUri: string | null; fullName: string | null }>();
    for (let i = 0; i < portfolioMeta.length; i++) {
      const meta = portfolioMeta[i];
      if (meta) {
        map.set(i, {
          tokenAddress: meta.tokenAddress,
          logoUri: meta.logoUri ?? null,
          fullName: meta.fullName ?? null,
        });
      }
    }
    return map;
  }, [portfolioMeta]);

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
          Object.assign(swap.sold, {
            toString: () => swap.sold.symbol ?? "Unknown",
          }), // sold column
          Object.assign(swap.bought, {
            toString: () => swap.bought.symbol ?? "Unknown",
          }), // bought column
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
          transferValueUsd ?? "—",
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
      const pairLabel = String(value || "").replace(/,/g, " → ");

      return (
        <SwapPairCell
          soldToken={soldToken ?? null}
          boughtToken={boughtToken ?? null}
          pairLabel={pairLabel}
        />
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
        isCurrentWallet,
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
        isCurrentWallet,
      );
    },
    (value: WalletSwapTokenInfo, row?: any) => {
      if (!value || typeof value !== "object") return renderCode(String(value));
      return renderTokenCell(
        value,
        fmt.num.compact.decimal,
        renderSwapTokenInfoClassnames,
        30,
        true,
      )(String(value.symbol ?? ""), row ?? null);
    },
    (value: number | null) => {
      if (value == null) return renderBase("—");
      return renderBase(fmt.num.currency(value));
    },
  ];

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
    if (!address || address === "null") {
      setWalletTags([]);
      return;
    }

    fetchWalletTags(address)
      .then(setWalletTags)
      .catch((error) => {
        console.error("[WalletPage] Failed to load wallet tags:", error);
        setWalletTags([]);
      });
  }, [address]);

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

  useEffect(() => {
    if (!address || address === "null") {
      setPortfolio([]);
      setSwapPages({});
      setSwapPageInfoByPage({});
      setTransferPages({});
      setTransferPageInfoByPage({});
      setOverviewReport(null);
      setIntelligenceReport(null);
      return;
    }

    // Load all data on mount
    void loadPortfolioData();
    void loadActivityData();

    fetchWalletOverview(address)
      .then(setOverviewReport)
      .catch((err) => console.error("[WalletPage] Failed to load overview:", err));

    fetchWalletIntelligence(address, "solana")
      .then(setIntelligenceReport)
      .catch((err) => console.error("[WalletPage] Failed to load intelligence:", err));
  }, [address, loadPortfolioData, loadActivityData]);

  const ensurePortfolioAndActivityForExport = useCallback(async (): Promise<{
    portfolio: WalletPortfolioItem[];
    swaps: WalletSwap[];
    transfers: WalletTransfer[];
  }> => {
    if (!address || address === "null") {
      return { portfolio: [], swaps: [], transfers: [] };
    }

    let p = portfolio;
    if (p.length === 0) {
      p = await loadPortfolioData();
    }

    let s = loadedSwaps;
    let t = loadedTransfers;
    if (s.length === 0 && t.length === 0) {
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
    return "overview";
  }, []);

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
        fetchWalletOverview(address),
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
          `${swap.sold.symbol ?? "Unknown"} (${fmt.num.compact.decimal(swap.sold.amount)})`,
          `${swap.bought.symbol ?? "Unknown"} (${fmt.num.compact.decimal(swap.bought.amount)})`,
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
          ["", "Token", "Price", "Holding", "Value"],
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
      const root = document.querySelector(`.${styles.mainCol}`);
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
          <>
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
           
          </>
        ),
        size: "lg",
        onClose: () => setSelectedToken(null),
      }}
    >
      <div className={styles.pageLayout}>
        <div className={styles.shell}>
          <WalletTopbar
            address={walletAddress}
            onAiAnalysisOpen={() => setAiAnalysisOpen(true)}
            onAuditOpen={() => setAuditOpen(true)}
            onExportData={handleExportDataXlsx}
            onExportCharts={handleExportChartsZip}
            onExportPdf={handleExportPagePdf}
            isExporting={isPagePdfExporting || isDataExporting || isChartsExporting}
            currentPeriod={selectedPeriod}
            onPeriodChange={(period) => setSelectedPeriod(period)}
          />

          <WalletHero
            overview={overviewReport}
            selectedPeriod={selectedPeriod}
            loading={false}
          />

          <div className={styles.body}>
            <div className={styles.mainCol}>
              {/* Balance History */}
              <div className={styles.section}>
                <BalanceChartV2
                  minHeight={324}
                  address={walletAddress}
                  onClickDay={(ts) => {
                    setDayPopupTimestamp(ts);
                    setDayPopupOpen(true);
                  }}
                />
              </div>

              {/* Profit & Loss */}
              <div className={styles.section}>
                <PnLChart
                  minHeight={324}
                  autoRefresh
                  initialFilters={{ wallets: [walletAddress] }}
                  onDayClick={(_wallet, ts) => {
                    setDayPopupTimestamp(ts);
                    setDayPopupOpen(true);
                  }}
                />
              </div>

              {/* Activity Tables */}
              <div className={styles.section}>
                <TabContainer
                  activeTab={activeActivityTab}
                  names={[
                    `${tr("walletPage.swap")} (${loadedSwaps.length})`,
                    `${tr("walletPage.transfer")} (${loadedTransfers.length})`,
                  ]}
                  actions={
                    <Button
                      size="sm"
                      kind="tertiary"
                      onClick={() => setAiSwapSummaryOpen(true)}
                    >
                      {/* {tr("walletPage.aiSwapSummary")}
                     */}
                      {tr("walletPage.aiSwapSummary.button")}
                    </Button>
                  }
                  onTabChange={(index) =>
                    setActiveActivityTab(index)
                  }
                  tabs={[
                    <Table
                      key="swaps-tab" // Need to set key to prevent React from reusing the same Table instance for both tabs, which causes issues with independent loading states and data
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
                      enableExport={false}
                      loading={swapLoading && loadedSwaps.length === 0}
                    />
                    // <div className={styles.chartSection} style={{ borderRadius: "0 0 12px 12px" }}>
                    // </div>
                    ,
                    <Table
                      key="transfers-tab" // Need to set key to prevent React from reusing the same Table instance for both tabs, which causes issues with independent loading states and data
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
                      onRowClick={(_row, rowIndex) => {
                        const transfer = loadedTransfers[rowIndex >= 0 ? rowIndex : -1];
                        if (transfer) {
                          setSelectedTransfer(transfer);
                          setTransferModalOpen(true);
                        }
                      }}
                      enableExport={false}
                      loading={transferLoading && loadedTransfers.length === 0}
                    />
                    // <div className={styles.chartSection} style={{ borderRadius: "0 0 12px 12px" }}>
                    // </div>,
                  ]}
                />
              </div>

            </div>

            <div className={styles.sideCol}>
              <WalletHoldingsPanel
                walletAddress={walletAddress}
                portfolio={portfolio}
                portfolioMeta={portfolioMetaAsMap}
                loading={portfolioLoading}
              />
            </div>
          </div>

          <div className={styles.tokenDetailsWrapper}>
            <TokenDetailsDemo setSelectedToken={setSelectedToken} />
          </div>
        </div>

        <RightSidebar
          currentAddress={address || ""}
          onToggle={setIsRightSidebarOpen}
        />
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
          overviewContent={null}
          holdingsContent={null}
          activityRiskContent={activityRiskPdfContent}
          reportDate={reportDate}
        />
      </div>

      <SwapDetailModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        swap={selectedSwap}
        walletAddress={walletAddress}
      />

      <TransferDetailModal
        isOpen={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        transfer={selectedTransfer}
        walletAddress={walletAddress}
      />

      <DayActivityPopup
        isOpen={dayPopupOpen}
        onClose={() => setDayPopupOpen(false)}
        wallets={[walletAddress]}
        dayTimestamp={dayPopupTimestamp}
      />

      <AiSwapSummaryModal
        isOpen={aiSwapSummaryOpen}
        onClose={() => setAiSwapSummaryOpen(false)}
        walletAddress={walletAddress}
      />

      <AiAnalysisModal
        isOpen={aiAnalysisOpen}
        onClose={() => setAiAnalysisOpen(false)}
        walletAddress={walletAddress}
        language={lang === "vi" ? "vi" : "en"}
      />

      {auditOpen && (
        <div
          className={styles.auditOverlay}
          onClick={() => setAuditOpen(false)}
        >
          <div
            className={styles.auditPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.auditHeader}>
              <span className={styles.auditTitle}>Forensic Audit</span>
              <button
                type="button"
                className={styles.auditCloseBtn}
                onClick={() => setAuditOpen(false)}
              >
                ✕
              </button>
            </div>
            <WalletAuditPanel
              walletAddress={walletAddress}
              enabled={auditOpen}
            />
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
