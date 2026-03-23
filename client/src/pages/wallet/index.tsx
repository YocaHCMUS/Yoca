import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { CounterpartyActivity } from "@/components/charts/CounterpartyActivity/CounterpartyActivity.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import TabContainer from "@/components/tabContainer/tabContainer.tsx";
import { FilterType, SortType, Table } from "@/components/tables/Table.tsx";
import {
  createSwapTokenCellRenderer,
  renderBase,
  renderCode,
  renderCurrency,
  renderDateTime,
  renderHash,
  renderPositiveNegative,
  renderReducedNumber,
} from "@/components/tables/TableCellRenderer.tsx";
import {
  SwapDetailModal,
} from "@/components/wallet/SwapDetailModal/SwapDetailModal.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { locale } from "@/config/localization/index.ts";
import { exportCurrentPageAsPdf } from "@/hooks/useChartExport.ts";
import { Button } from "@carbon/react";
import { ChevronDown, Download } from "@carbon/icons-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import {
  fetchWalletCounterparties,
  fetchWalletPortfolio,
  fetchWalletTransfers,
  fetchWalletSwaps,
  type WalletCounterpartyRow,
  type WalletPageInfo,
  type WalletPortfolioItem,
  type WalletSwap,
  type WalletTransfer,
} from "@/services/wallet/walletApi.ts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import {
  mapPortfolioItems,
  buildPortfolioMetaMap,
} from "../../util/wallet-portfolio-mapper.ts";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import styles from "./index.module.scss";
import { BalanceChart } from "@/components/charts/BalanceChart/index.ts";
import { PnLChart } from "@/components/charts/PnLChart/index.ts";

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
    .sort((a, b) => a - b)
    .flatMap((page) => pages[page] ?? []);
}

export default function WalletPage() {
  const { tr, fmt, lang } = useLocalization();
  const bcp47 = locale[lang].langCode;
  const { address } = useParams<{ address: string }>();
  const [swapPages, setSwapPages] = useState<Record<number, WalletSwap[]>>({});
  const [swapPageInfoByPage, setSwapPageInfoByPage] = useState<Record<number, WalletPageInfo>>({});
  const [swapLoading, setSwapLoading] = useState(false);

  const [transferPages, setTransferPages] = useState<Record<number, WalletTransfer[]>>({});
  const [transferPageInfoByPage, setTransferPageInfoByPage] = useState<Record<number, WalletPageInfo>>({});
  const [transferLoading, setTransferLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [counterpartyLoading, setCounterpartyLoading] = useState(false);

  const [portfolio, setPortfolio] = useState<WalletPortfolioItem[]>([]);
  const [counterparties, setCounterparties] = useState<WalletCounterpartyRow[]>([]);

  const [mainActiveTab, setMainActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0);
  const [isPagePdfExporting, setIsPagePdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isDataExporting, setIsDataExporting] = useState(false);
  const [isChartsExporting, setIsChartsExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  // Resizable divider
  const [leftWidth, setLeftWidth] = useState(420);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(420);

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartWidth.current = leftWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [leftWidth]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(700, Math.max(280, dragStartWidth.current + delta));
      setLeftWidth(next);
    };
    const onMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
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

  const loadedSwaps = useMemo(
    () => flattenLoadedPages(swapPages),
    [swapPages],
  );

  const loadedTransfers = useMemo(
    () => flattenLoadedPages(transferPages),
    [transferPages],
  );

  const swapBySignature = useMemo(
    () => new Map(loadedSwaps.map((swap) => [swap.signature, swap])),
    [loadedSwaps],
  );

  const transferByKey = useMemo(
    () =>
      new Map(
        loadedTransfers.map((transfer) => [
          `${transfer.transactionSignature}:${transfer.instructionIndex}`,
          transfer,
        ]),
      ),
    [loadedTransfers],
  );

  const swapHasMore = useMemo(() => {
    const maxLoadedPage = getMaxLoadedPage(swapPages);
    if (maxLoadedPage < 1) {
      return false;
    }

    return Boolean(swapPageInfoByPage[maxLoadedPage]?.hasMore);
  }, [swapPageInfoByPage, swapPages]);

  const transferHasMore = useMemo(() => {
    const maxLoadedPage = getMaxLoadedPage(transferPages);
    if (maxLoadedPage < 1) {
      return false;
    }

    return Boolean(transferPageInfoByPage[maxLoadedPage]?.hasMore);
  }, [transferPageInfoByPage, transferPages]);

  const { rows: portfolioData, meta: portfolioMeta } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );

  const portfolioMetaMap = useMemo(
    () => buildPortfolioMetaMap(portfolioMeta),
    [portfolioMeta],
  );

  const balanceTokenOptions = useMemo(
    () =>
      Array.from(
        new Set(
          portfolio
            .map((item) => item.symbol.trim().toUpperCase())
            .filter((symbol) => symbol.length > 0),
        ),
      ).slice(0, 12),
    [portfolio],
  );

  const getSoldBoughtChanges = (swap: WalletSwap) => {
    const soldFromBalance = swap.balanceChanges.find((change) => change.amount < 0);
    const boughtFromBalance = swap.balanceChanges.find((change) => change.amount > 0);

    return {
      sold: swap.sold ?? soldFromBalance ?? null,
      bought: swap.bought ?? boughtFromBalance ?? null,
    };
  };

  const getSwapTokenLabel = (change: WalletSwap["sold"]): string => {
    if (!change) {
      return tr('walletPage.unknown').toUpperCase();
    }

    const symbolCandidate = (change.symbol ?? "").trim();
    if (symbolCandidate.length > 0) {
      return symbolCandidate.toUpperCase();
    }

    const mint = change.mint || "";
    if (mint.length > 8) {
      return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
    }

    return mint || tr('walletPage.unknown').toUpperCase();
  };

  const formatSwapTokenDisplay = (change: WalletSwap["sold"]): string => {
    if (!change) return "—";

    const amount = Math.abs(change.amount).toFixed(4);
    return `${amount} ${getSwapTokenLabel(change)}`;
  };

  const formatSwapPair = (swap: WalletSwap): string => {
    const pairLabel = swap.pair?.label?.trim();
    if (pairLabel) {
      return pairLabel;
    }

    const pairAddress = swap.pair?.address ?? null;
    if (pairAddress && pairAddress.length > 8) {
      return `${pairAddress.slice(0, 4)}...${pairAddress.slice(-4)}`;
    }

    return pairAddress ?? "—";
  };

  const swapData = useMemo(
    () =>
      loadedSwaps.map((swap) => {
        const { sold, bought } = getSoldBoughtChanges(swap);
        return [
          swap.timestamp,
          swap.exchange?.name ?? "—",
          formatSwapPair(swap),
          formatSwapTokenDisplay(sold),
          formatSwapTokenDisplay(bought),
          swap.totalValueUsd ?? "—",
          swap.fee,
          swap.signature,
        ];
      }),
    [loadedSwaps, formatSwapPair, formatSwapTokenDisplay, getSoldBoughtChanges],
  );

  const transferData = useMemo(
    () =>
      loadedTransfers.map((transfer) => [
        transfer.from,
        transfer.to,
        transfer.tokenSymbol,
        transfer.amount,
        transfer.timestamp,
        `${transfer.transactionSignature}:${transfer.instructionIndex}`,
      ]),
    [loadedTransfers],
  );

  const counterpartyTableData = useMemo(
    () =>
      counterparties.map((row) => {
        const identityLabel =
          row.identity.name ||
          (row.identity.status === "known"
            ? tr('walletPage.identityKnown')
            : row.identity.status === "unavailable"
              ? tr('walletPage.identityUnavailable')
              : tr('walletPage.unknown'));

        return [
          row.address,
          identityLabel,
          row.uniqueTokenCount,
          row.tokens.join(", "),
          row.totalVolumeUsd,
          row.transactionCount,
        ];
      }),
    [counterparties],
  );

  const counterpartyHeaders = [
    tr('walletPage.counterparties'),
    tr('walletPage.identity'),
    tr('walletPage.uniqueTokensTraded'),
    tr('walletPage.tokenList'),
    tr('walletPage.totalVolume'),
    tr('charts.counterpartyActivityChart.transactionCount'),
  ];

  const swapHeaders = [
    tr("walletPage.time"),
    tr("walletPage.exchange"),
    tr("walletPage.pair"),
    tr("walletPage.tokenSold"),
    tr("walletPage.tokenBought"),
    tr("walletPage.totalValueUSD"),
    tr("walletPage.feeInLamports"),
  ];

  const transferHeaders = [
    tr("walletPage.sender"),
    tr("walletPage.receiver"),
    tr("walletPage.token"),
    tr("walletPage.amount"),
    tr("walletPage.time"),
  ];

  const portfolioHeaders = [
    tr("walletPage.token"),
    tr("walletPage.price"),
    tr("walletPage.holding"),
    tr("walletPage.value"),
    tr("walletPage.change24h"),
  ];

  const isSortableCounterparties = [false, false, true, false, true, true];
  const isSortablePortfolio = [false, true, true, true, true];
  const isSortableSwaps = [true, false, false, false, false, true, true];
  const isSortableTransfers = [false, false, false, true, true];

  const counterpartySortConfigs = {
    2: { type: SortType.Number },
    4: { type: SortType.Number },
    5: { type: SortType.Number },
  };

  const swapSortConfigs = {
    0: { type: SortType.Date },
    5: { type: SortType.Number },
    6: { type: SortType.Number },
  };

  const transferSortConfigs = {
    3: { type: SortType.Number },
    4: { type: SortType.Date },
  };

  const portfolioSortConfig = {
    1: { type: SortType.Number },
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  const counterpartyCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
  ];

  const renderSwapTokenCell = (side: "sold" | "bought") =>
    createSwapTokenCellRenderer({
      side,
      swapBySignature,
      getSoldBoughtChanges,
      getSwapTokenLabel,
      classNames: {
        container: styles.swapTokenCell,
        amount: styles.swapTokenAmount,
      },
      imageSize: 18,
    });

  const swapCellRenderers = [
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    (value: string) => renderCode(value),
    (value: string) => renderCode(value),
    renderSwapTokenCell("sold"),
    renderSwapTokenCell("bought"),
    (value: string) =>
      value === "—"
        ? renderBase(value)
        : renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
  ];

  const transferCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderHash(value),
    (value: string, row?: unknown[] | null) => {
      if (!Array.isArray(row) || row.length < 6) {
        return renderCode(value);
      }

      const transferKey = String(row[5] ?? "");
      const transfer = transferByKey.get(transferKey);

      if (!transfer) {
        return renderCode(value);
      }

      return (
        <TokenIdentityCell
          symbol={String(transfer.tokenSymbol ?? value)}
          fullName={transfer.tokenName}
          imageUrl={transfer.tokenLogoUri}
          imageSize={18}
          showInitialsFallback
          tooltipAlign="right"
        />
      );
    },
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
  ];

  const portfolioCellRenderers = [
    (value: string) => {
      const tokenMeta = portfolioMetaMap.get(value);

      return (
        <TokenIdentityCell
          symbol={value}
          fullName={tokenMeta?.fullName}
          imageUrl={tokenMeta?.logoUri}
          imageSize={20}
          showInitialsFallback
          tooltipAlign="right"
        />
      );
    },
    (value: string) => renderCurrency(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderCurrency(value),
    (value: string) => renderPositiveNegative(value, true, true),
  ];

  const counterpartyFilterSchema = {
    0: { type: FilterType.Select },
    1: { type: FilterType.Select },
    2: { type: FilterType.Range, min: 0, max: 100, step: 1 },
    3: { type: FilterType.Select },
    4: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.01 },
    5: { type: FilterType.Range, min: 0, max: 10_000, step: 1 },
  };

  const portfolioFilterSchema = {
    0: { type: FilterType.Select },
    1: { type: FilterType.Range, min: 0, max: 500, step: 0.01 },
    2: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.001 },
    3: { type: FilterType.Range, min: 0, max: 100_000, step: 0.01 },
    4: { type: FilterType.Range, min: -1, max: 1, step: 0.001 },
  };

  const handleSwapPageChange = async (targetPage: number): Promise<boolean> => {
    void targetPage;

    if (!address || swapLoading) {
      return false;
    }

    const maxLoadedPage = getMaxLoadedPage(swapPages);
    if (maxLoadedPage < 1) {
      return false;
    }

    const previousPageInfo = swapPageInfoByPage[maxLoadedPage];
    if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor) {
      return false;
    }

    setSwapLoading(true);
    try {
      const response = await fetchWalletSwaps(address, {
        cursor: previousPageInfo.nextCursor,
        before: previousPageInfo.nextCursor,
      });

      const nextRows = Array.isArray(response.swaps) ? response.swaps : [];
      const nextPage = maxLoadedPage + 1;
      setSwapPages((prev) => ({
        ...prev,
        [nextPage]: nextRows,
      }));
      setSwapPageInfoByPage((prev) => ({
        ...prev,
        [nextPage]: response.pageInfo,
      }));
      return nextRows.length > 0;
    } catch (err) {
      console.error("Failed to load wallet swap page", err);
      return false;
    } finally {
      setSwapLoading(false);
    }
  };

  const handleTransferPageChange = async (targetPage: number): Promise<boolean> => {
    void targetPage;

    if (!address || transferLoading) {
      return false;
    }

    const maxLoadedPage = getMaxLoadedPage(transferPages);
    if (maxLoadedPage < 1) {
      return false;
    }

    const previousPageInfo = transferPageInfoByPage[maxLoadedPage];
    if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor) {
      return false;
    }

    setTransferLoading(true);
    try {
      const response = await fetchWalletTransfers(address, {
        cursor: previousPageInfo.nextCursor,
      });

      const nextRows = Array.isArray(response.transfers) ? response.transfers : [];
      const nextPage = maxLoadedPage + 1;
      setTransferPages((prev) => ({
        ...prev,
        [nextPage]: nextRows,
      }));
      setTransferPageInfoByPage((prev) => ({
        ...prev,
        [nextPage]: response.pageInfo,
      }));
      return nextRows.length > 0;
    } catch (err) {
      console.error("Failed to load wallet transfer page", err);
      return false;
    } finally {
      setTransferLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!address || address === 'null') return;

      setPortfolioLoading(true);
      setSwapLoading(true);
      setTransferLoading(true);
      setCounterpartyLoading(true);

      try {
        const [portfolioResult, swapsResult, transfersResult, counterpartiesResult] = await Promise.allSettled([
          fetchWalletPortfolio(address),
          fetchWalletSwaps(address),
          fetchWalletTransfers(address),
          fetchWalletCounterparties(address, {
            period: '7d',
            limit: 50,
            includeTokens: true,
          }),
        ]);

        if (portfolioResult.status === 'fulfilled' && Array.isArray(portfolioResult.value)) {
          setPortfolio(portfolioResult.value);
        }

        if (swapsResult.status === 'fulfilled') {
          const swapsData = swapsResult.value?.swaps || [];
          if (Array.isArray(swapsData)) {
            setSwapPages({ 1: swapsData });
            setSwapPageInfoByPage({ 1: swapsResult.value.pageInfo });
            console.log("[swaps] ✓ loaded:", swapsData.length, "swaps");
          }
        }

        if (transfersResult.status === 'fulfilled') {
          const transfersData = transfersResult.value?.transfers || [];
          if (Array.isArray(transfersData)) {
            setTransferPages({ 1: transfersData });
            setTransferPageInfoByPage({ 1: transfersResult.value.pageInfo });
            console.log('[transfers] ✓ loaded:', transfersData.length, 'transfers');
          }
        }

        if (counterpartiesResult.status === 'fulfilled') {
          const counterpartiesData = counterpartiesResult.value?.counterparties ?? [];
          if (Array.isArray(counterpartiesData)) {
            setCounterparties(counterpartiesData);
            console.log('[counterparties] ✓ loaded:', counterpartiesData.length, 'rows');
          }
        }
      } catch (err) {
        console.error('Failed to load wallet data:', err);
      } finally {
        setPortfolioLoading(false);
        setSwapLoading(false);
        setTransferLoading(false);
        setCounterpartyLoading(false);
      }
    };

    loadData();
  }, [address]);

  function handleSwapRowClick(_row: unknown[], rowIndex: number) {
    const swap = loadedSwaps[rowIndex >= 0 ? rowIndex : -1];
    if (!swap) return;

    setSelectedSwap(swap);
    setSwapModalOpen(true);
  }

  async function handleExportPagePdf() {
    if (isPagePdfExporting) return;

    setIsPagePdfExporting(true);
    try {
      await exportCurrentPageAsPdf({
        title: `${tr("walletPage.activity")} ${address}`,
        baseFilename: `wallet-page-${address?.slice(0, 8) || 'overview'}`,
      });
    } catch (error) {
      console.error("[WalletPage] Failed to export page PDF:", error);
      window.alert(tr('walletPage.exportPdfFailed'));
    } finally {
      setIsPagePdfExporting(false);
    }
  }

  function handleExportDataXlsx() {
    try {
      setIsDataExporting(true);

      const workbook = XLSX.utils.book_new();

      const swapSheet = XLSX.utils.aoa_to_sheet([swapHeaders, ...swapData]);
      XLSX.utils.book_append_sheet(workbook, swapSheet, "Swaps");

      const transferSheet = XLSX.utils.aoa_to_sheet([transferHeaders, ...transferData]);
      XLSX.utils.book_append_sheet(workbook, transferSheet, "Transfers");

      const counterpartySheet = XLSX.utils.aoa_to_sheet([
        counterpartyHeaders,
        ...counterpartyTableData,
      ]);
      XLSX.utils.book_append_sheet(workbook, counterpartySheet, "Counterparties");

      const portfolioSheet = XLSX.utils.aoa_to_sheet([portfolioHeaders, ...portfolioData]);
      XLSX.utils.book_append_sheet(workbook, portfolioSheet, "Portfolio");

      const filename = `wallet-data-${address?.slice(0, 8) || "overview"}-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5)}.xlsx`;
      XLSX.writeFile(workbook, filename);
    } catch (error) {
      console.error("[WalletPage] Failed to export XLSX:", error);
      window.alert(tr('walletPage.exportXlsxFailed'));
    } finally {
      setIsDataExporting(false);
      setIsExportMenuOpen(false);
    }
  }

  async function handleExportChartsZip() {
    try {
      setIsChartsExporting(true);

      const root = document.querySelector(`.${styles.rightContent}`);
      if (!root) {
        throw new Error("Chart container not found");
      }

      const zip = new JSZip();
      const imagesFolder = zip.folder("charts");
      if (!imagesFolder) {
        throw new Error("Unable to create ZIP folder");
      }

      const canvases = Array.from(root.querySelectorAll("canvas"));
      if (canvases.length === 0) {
        throw new Error("No chart images found to export");
      }

      const addCanvasBlob = async (canvas: HTMLCanvasElement, index: number) => {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png"),
        );
        if (!blob) return;
        imagesFolder.file(`chart-${index + 1}.png`, blob);
      };

      await Promise.all(canvases.map((canvas, index) => addCanvasBlob(canvas, index)));

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wallet-charts-${address?.slice(0, 8) || "overview"}-${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, -5)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error("[WalletPage] Failed to export charts ZIP:", error);
      window.alert(tr('walletPage.exportZipFailed'));
    } finally {
      setIsChartsExporting(false);
      setIsExportMenuOpen(false);
    }
  }

  if (!address) {
    return (
      <PageWrapper>
        <div>{tr("walletPage.addressNotFound")}</div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div
        className={styles.walletGrid}
        style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(0, 1fr)` }}
      >
        {/* ── Left Column: Wallet Sidebar ── */}
        <div className={styles.leftColumn}>
          <WalletOverview walletAddress={address} />
        </div>

        {/* ── Resize Divider ── */}
        <div
          className={styles.resizeDivider}
          onMouseDown={handleDividerMouseDown}
        >
          <div className={styles.resizeHandle} />
        </div>

        {/* ── Right Column: Main Content ── */}
        <div className={styles.rightColumn}>
          <div className={styles.rightHeader}>
            <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
              <Button
                size="sm"
                kind="secondary"
                renderIcon={ChevronDown}
                onClick={() => setIsExportMenuOpen((prev) => !prev)}
                disabled={isPagePdfExporting || isDataExporting || isChartsExporting}
              >
                {tr('charts.export')}
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
                    {isDataExporting ? tr('walletPage.exportingData') : tr('walletPage.exportDataXlsx')}
                  </button>
                  <button
                    type="button"
                    className={styles.exportMenuItem}
                    onClick={handleExportChartsZip}
                    disabled={isChartsExporting}
                  >
                    <Download size={16} />
                    {isChartsExporting ? tr('walletPage.exportingCharts') : tr('walletPage.exportChartsZip')}
                  </button>
                  <button
                    type="button"
                    className={styles.exportMenuItem}
                    onClick={handleExportPagePdf}
                    disabled={isPagePdfExporting}
                  >
                    <Download size={16} />
                    {isPagePdfExporting ? tr('walletPage.exportingReport') : tr('walletPage.exportReportPdf')}
                  </button>
                </div>
              )}
            </div>
          </div>


          <div className={styles.rightContent}>
            <h1 className={styles.sectionTitle}>{tr("walletPage.activity")}</h1>
            {/* Balance / PnL Charts */}
            <div className={styles.section}>
              <div className={styles.chartSection}>
                <TabContainer
                  activeTab={mainActiveTab}
                  names={[
                    tr("walletPage.balanceHistory"),
                    tr("walletPage.profitLoss"),
                  ]}
                  tabs={[
                    <BalanceChart
                      minHeight={460}
                      initialFilters={{
                        timePeriod: "7D",
                        wallets: [address],
                      }}
                      tokenSelectorOptions={balanceTokenOptions.length > 0 ? balanceTokenOptions : ['SOL', 'USDC', 'USDT']}
                      autoRefresh={true}
                    />,
                    <PnLChart
                      minHeight={400}
                      aggregation="daily"
                      autoRefresh={true}
                      initialFilters={{
                        timePeriod: "7D",
                        wallets: [address],
                      }}
                    />,
                  ]}
                  onTabChange={(index) => setMainActiveTab(index)}
                />
              </div>
            </div>

            {/* Swap / Transfer / Inflow / Outflow / Counterparties Tables */}
            <div className={styles.section}>
              <div className={styles.chartSection}>
                <TabContainer
                  activeTab={secondaryActiveTab}
                  names={[
                    tr("walletPage.swap"),
                    tr("walletPage.transfer"),
                    tr("walletPage.counterparties"),
                  ]}
                  tabs={[
                    <Table
                      maxHeight={400}
                      title={tr("walletPage.swap")}
                      headers={swapHeaders}
                      initialFilters={{}}
                      fetcher={Promise.resolve(swapData)}
                      filterSchema={{
                        0: { type: FilterType.Select },
                        1: { type: FilterType.Select },
                        2: { type: FilterType.Select },
                        3: { type: FilterType.Select },
                        4: { type: FilterType.Select },
                        5: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.01 },
                        6: { type: FilterType.Range, min: 0, max: 1, step: 0.000001 },
                      }}
                      cellRenderers={swapCellRenderers}
                      dataEntries={swapData}
                      isSortable={isSortableSwaps}
                      sortConfigs={swapSortConfigs}
                      onRowClick={handleSwapRowClick}
                      loading={swapLoading && loadedSwaps.length === 0}
                      serverPagination={{
                        enabled: true,
                        hasMore: swapHasMore,
                        isLoading: swapLoading,
                        onPageChange: handleSwapPageChange,
                      }}
                    />,
                    <Table
                      maxHeight={400}
                      title={tr("walletPage.transfer")}
                      headers={transferHeaders}
                      initialFilters={{}}
                      fetcher={Promise.resolve(transferData)}
                      filterSchema={{
                        0: { type: FilterType.Select },
                        1: { type: FilterType.Select },
                        2: { type: FilterType.Select },
                        3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 },
                        4: { type: FilterType.Select },
                      }}
                      cellRenderers={transferCellRenderers}
                      dataEntries={transferData}
                      isSortable={isSortableTransfers}
                      sortConfigs={transferSortConfigs}
                      loading={transferLoading && loadedTransfers.length === 0}
                      serverPagination={{
                        enabled: true,
                        hasMore: transferHasMore,
                        isLoading: transferLoading,
                        onPageChange: handleTransferPageChange,
                      }}
                    />,
                    <Table
                      maxHeight={400}
                      title={tr("walletPage.counterparties")}
                      headers={counterpartyHeaders}
                      initialFilters={{}}
                      fetcher={Promise.resolve(counterpartyTableData)}
                      filterSchema={counterpartyFilterSchema}
                      cellRenderers={counterpartyCellRenderers}
                      dataEntries={counterpartyTableData}
                      isSortable={isSortableCounterparties}
                      sortConfigs={counterpartySortConfigs}
                      loading={counterpartyLoading && counterpartyTableData.length === 0}
                    />,
                  ]}
                  onTabChange={(index) => setSecondaryActiveTab(index)}
                />
              </div>
            </div>

            {/* Assets: Distribution + Portfolio */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>{tr("walletPage.asset")}</h2>
              <div className={styles.sideBySide}>
                <div className={styles.columnWrapper}>
                  <AssetDistribution
                    initialFilters={{
                      wallets: address ? [address] : [],
                      timePeriod: "30D",
                    }}
                    autoRefresh={true}
                  />
                </div>
                <div className={styles.columnWrapper}>
                  <Table
                    maxHeight={800}
                    title={tr("walletPage.portfolio")}
                    headers={portfolioHeaders}
                    initialFilters={{}}
                    fetcher={Promise.resolve(portfolioData)}
                    filterSchema={portfolioFilterSchema}
                    cellRenderers={portfolioCellRenderers}
                    dataEntries={portfolioData}
                    isSortable={isSortablePortfolio}
                    sortConfigs={portfolioSortConfig}
                    loading={portfolioLoading && portfolioData.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* Top Exchange */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>{tr("walletPage.topExchange")}</h2>
              <div className={styles.chartSection}>
                <ExchangeComparison walletAddress={address} />
              </div>
            </div>

            {/* Top Counterparties */}
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                {tr("walletPage.topCounterparties")}
              </h2>
              <div className={styles.chartSection}>
                <CounterpartyActivity
                  minHeight={320}
                  initialFilters={{
                    timePeriod: "7D",
                    wallets: [address],
                  }}
                  autoRefresh={true}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <SwapDetailModal
        isOpen={swapModalOpen}
        onClose={() => setSwapModalOpen(false)}
        swap={selectedSwap}
      />
    </PageWrapper>
  );
}
