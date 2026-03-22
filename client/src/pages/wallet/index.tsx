import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { CounterpartyActivity } from "@/components/charts/CounterpartyActivity/CounterpartyActivity.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import TabContainer from "@/components/tabContainer/tabContainer.tsx";
import { FilterType, SortType, Table } from "@/components/tables/Table.tsx";
import {
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
import { Download } from "@carbon/icons-react";
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
import { useEffect, useMemo, useState } from "react";
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

  const [portfolio, setPortfolio] = useState<WalletPortfolioItem[]>([]);
  const [counterparties, setCounterparties] = useState<WalletCounterpartyRow[]>([]);

  const [activeTab, setActiveTab] = useState(0);
  const [secondaryActiveTab, setSecondaryActiveTab] = useState(0);
  const [isPagePdfExporting, setIsPagePdfExporting] = useState(false);

  // Swap detail modal state
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

  // Transform portfolio data from API response for Table component using typed mapper.
  // Numeric values are kept as numbers (not pre-formatted strings) so that
  // SortType.Number and FilterType.Range work correctly on price/amount/value/change.
  const { rows: portfolioData, meta: portfolioMeta } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );

  // O(1) lookup: resolved token label → portfolio row metadata (logoUri, etc.)
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
      return "UNKNOWN";
    }

    const symbolCandidate = (change.symbol ?? "").trim();
    if (symbolCandidate.length > 0) {
      return symbolCandidate.toUpperCase();
    }

    const mint = change.mint || "";
    if (mint.length > 8) {
      return `${mint.slice(0, 4)}...${mint.slice(-4)}`;
    }

    return mint || "UNKNOWN";
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

  // Transform swap data to array format for Table component
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

  // Transform transfer data to array format for Table component
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

  // Filter transfers by direction
  const inflowData = transferData.filter(
    (row) => address && row[1] === address,
  );
  const outflowData = transferData.filter(
    (row) => address && row[0] === address,
  );

  const counterpartyTableData = useMemo(
    () =>
      counterparties.map((row) => {
        const identityLabel =
          row.identity.name ||
          (row.identity.status === "known"
            ? "Known"
            : row.identity.status === "unavailable"
              ? "Unavailable"
              : "Unknown");

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
    "Counterparty",
    "Identity",
    "Unique tokens traded",
    "Token list",
    "Total volume",
    "Transaction count",
  ];

  const swapHeaders = [
    tr("walletPage.time"),
    "Exchange",
    "Pair",
    "Token Sold",
    "Token Bought",
    "Total Value (USD)",
    "Fee (lamport)",
  ];

  const transferHeaders = [
    tr("walletPage.seller"),
    tr("walletPage.buyer"),
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

  // Sort configurations for sortable columns
  const counterpartySortConfigs = {
    2: { type: SortType.Number },
    4: { type: SortType.Number },
    5: { type: SortType.Number },
  };

  const swapSortConfigs = {
    0: { type: SortType.Date }, // Time
    5: { type: SortType.Number }, // Total Value (USD)
    6: { type: SortType.Number }, // Fee
  };

  const transferSortConfigs = {
    3: { type: SortType.Number }, // Amount
    4: { type: SortType.Date }, // Time
  };

  const portfolioSortConfig = {
    1: { type: SortType.Number },
    2: { type: SortType.Number },
    3: { type: SortType.Number },
    4: { type: SortType.Number },
  };

  // Cell renderers for conditional styling
  const counterpartyCellRenderers = [
    (value: string) => renderHash(value),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    (value: string) => renderCode(value),
    (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
  ];

  const swapCellRenderers = [
    (value: string) => renderDateTime(value, fmt.datetime["relative"]),
    (value: string) => renderCode(value),
    (value: string) => renderCode(value),
    (value: string, row?: unknown[] | null) => {
      if (!Array.isArray(row)) {
        return renderCode(value);
      }

      const signature = String(row[7] ?? "");
      const swap = swapBySignature.get(signature);
      if (!swap) {
        return renderCode(value);
      }

      const { sold } = getSoldBoughtChanges(swap);
      if (!sold) {
        return renderBase("—");
      }

      return (
        <span className={styles.swapTokenCell}>
          <span className={styles.swapTokenAmount}>{Math.abs(sold.amount).toFixed(4)}</span>
          <TokenIdentityCell
            symbol={getSwapTokenLabel(sold)}
            fullName={sold.name ?? undefined}
            imageUrl={sold.logoUri ?? undefined}
            imageSize={18}
            showInitialsFallback
            tooltipAlign="right"
          />
        </span>
      );
    },
    (value: string, row?: unknown[] | null) => {
      if (!Array.isArray(row)) {
        return renderCode(value);
      }

      const signature = String(row[7] ?? "");
      const swap = swapBySignature.get(signature);
      if (!swap) {
        return renderCode(value);
      }

      const { bought } = getSoldBoughtChanges(swap);
      if (!bought) {
        return renderBase("—");
      }

      return (
        <span className={styles.swapTokenCell}>
          <span className={styles.swapTokenAmount}>{Math.abs(bought.amount).toFixed(4)}</span>
          <TokenIdentityCell
            symbol={getSwapTokenLabel(bought)}
            fullName={bought.name ?? undefined}
            imageUrl={bought.logoUri ?? undefined}
            imageSize={18}
            showInitialsFallback
            tooltipAlign="right"
          />
        </span>
      );
    },
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
    // Column 0: token label + optional logo image
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
    // Column 1: USD price per token
    (value: string) => renderCurrency(value),
    // Column 2: raw token amount – formatted for display, sortable as number
    (value: string) => renderReducedNumber(value, renderBase, bcp47),
    // Column 3: USD value of holding
    (value: string) => renderCurrency(value),
    // Column 4: 24-hour change (fractional, e.g. 0.05 = 5%)
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
    0: { type: FilterType.Select }, // Token label - Select filter
    1: { type: FilterType.Range, min: 0, max: 500, step: 0.01 }, // Price (USD)
    2: { type: FilterType.Range, min: 0, max: 1_000_000, step: 0.001 }, // Amount (tokens)
    3: { type: FilterType.Range, min: 0, max: 100_000, step: 0.01 }, // Value (USD)
    4: { type: FilterType.Range, min: -1, max: 1, step: 0.001 }, // Change24h (fraction)
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

      try {
        // Fetch portfolio data
        const portfolioResponse = await fetchWalletPortfolio(address);
        if (Array.isArray(portfolioResponse)) {
          setPortfolio(portfolioResponse);
        }

        // Fetch swaps data for swap table
        const swapResponse = await fetchWalletSwaps(address);
        const swapsData = swapResponse?.swaps || [];
        if (Array.isArray(swapsData)) {
          setSwapPages({ 1: swapsData });
          setSwapPageInfoByPage({ 1: swapResponse.pageInfo });
          console.log("[swaps] ✓ loaded:", swapsData.length, "swaps");
        }

        // Fetch transfers data for inflow/outflow tables
        const transferResponse = await fetchWalletTransfers(address);
        const transfersData = transferResponse?.transfers || [];
        if (Array.isArray(transfersData)) {
          setTransferPages({ 1: transfersData });
          setTransferPageInfoByPage({ 1: transferResponse.pageInfo });
          console.log('[transfers] ✓ loaded:', transfersData.length, 'transfers');
        }

        const counterpartyResponse = await fetchWalletCounterparties(address, {
          period: '7d',
          limit: 50,
          includeTokens: true,
        });
        const counterpartiesData = counterpartyResponse?.counterparties ?? [];
        if (Array.isArray(counterpartiesData)) {
          setCounterparties(counterpartiesData);
          console.log('[counterparties] ✓ loaded:', counterpartiesData.length, 'rows');
        }
      } catch (err) {
        console.error('Failed to load wallet data:', err);
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
    } finally {
      setIsPagePdfExporting(false);
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
      <WalletOverview walletAddress={address} />
      <div className={styles.sectionHeader}>
        <h1 className={styles.sectionTitle}>{tr("walletPage.activity")}</h1>
        <Button
          size="sm"
          kind="secondary"
          renderIcon={Download}
          onClick={handleExportPagePdf}
          disabled={isPagePdfExporting}
        >
          {isPagePdfExporting ? `${tr("charts.exportPDF")}...` : tr("charts.exportPDF")}
        </Button>
      </div>
      <div className={styles.chartContainer}>
        <TabContainer
          activeTab={activeTab}
          names={[
            tr("walletPage.balanceHistory"),
            tr("walletPage.tokenBalanceHistory"),
            tr("walletPage.profitLoss"),
          ]}
          tabs={[
            <BalanceChart
              minHeight={460}
              initialFilters={{
                timePeriod: "30D",
                wallets: [address],
              }}
              balanceChartMode="total"
              autoRefresh={true}
            />,
            <BalanceChart
              minHeight={460}
              initialFilters={{
                timePeriod: "7D",
                wallets: [address],
                tokens: ["SOL"],
              }}
              balanceChartMode="token"
              enableTokenSelector={true}
              tokenSelectorOptions={balanceTokenOptions.length > 0 ? balanceTokenOptions : ['SOL', 'USDC', 'USDT']}
              allowMultiTokenSelection={true}
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
          ]} //for testing purpose
          onTabChange={(index) => setActiveTab(index)}
        />
        <TabContainer
          activeTab={secondaryActiveTab}
          names={[
            tr("walletPage.transfer"),
            tr("walletPage.inflow"),
            tr("walletPage.outflow"),
            tr("walletPage.counterparties"),
          ]}
          tabs={[
            <Table
              maxHeight={400}
              title={"swap"}
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
              serverPagination={{
                enabled: true,
                hasMore: swapHasMore,
                isLoading: swapLoading,
                onPageChange: handleSwapPageChange,
              }}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.inflow")}
              headers={transferHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(inflowData)}
              filterSchema={{
                0: { type: FilterType.Select },
                1: { type: FilterType.Select },
                2: { type: FilterType.Select },
                3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 },
                4: { type: FilterType.Select },
              }}
              cellRenderers={transferCellRenderers}
              dataEntries={inflowData}
              isSortable={isSortableTransfers}
              sortConfigs={transferSortConfigs}
              serverPagination={{
                enabled: true,
                hasMore: transferHasMore,
                isLoading: transferLoading,
                onPageChange: handleTransferPageChange,
              }}
            />,
            <Table
              maxHeight={400}
              title={tr("walletPage.outflow")}
              headers={transferHeaders}
              initialFilters={{}}
              fetcher={Promise.resolve(outflowData)}
              filterSchema={{
                0: { type: FilterType.Select },
                1: { type: FilterType.Select },
                2: { type: FilterType.Select },
                3: { type: FilterType.Range, min: 0, max: 10000, step: 0.01 },
                4: { type: FilterType.Select },
              }}
              cellRenderers={transferCellRenderers}
              dataEntries={outflowData}
              isSortable={isSortableTransfers}
              sortConfigs={transferSortConfigs}
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
            />,
          ]}
          onTabChange={(index) => setSecondaryActiveTab(index)}
        />
      </div>

      <h1 className={styles.sectionTitle}>{tr("walletPage.asset")}</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
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
          />
        </div>
      </div>

      <h1 className={styles.sectionTitle}>{tr("walletPage.topExchange")}</h1>
      {/* mock component for space, replace with implemented components */}
      <div className={styles.chartContainer}>
        <ExchangeComparison walletAddress={address} />
      </div>

      <h1 className={styles.sectionTitle}>
        {tr("walletPage.topCounterparties")}
      </h1>
      <div className={styles.chartContainer}>
        <CounterpartyActivity
          minHeight={320}
          initialFilters={{
            timePeriod: "7D",
            wallets: [address],
          }}
          autoRefresh={true}
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
