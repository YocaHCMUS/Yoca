import { AssetDistribution } from "@/components/charts/AssetDistribution/AssetDistribution.tsx";
import { CounterpartyActivity } from "@/components/charts/CounterpartyActivity/CounterpartyActivity.tsx";
import { ExchangeComparison } from "@/components/charts/ExchangeComparison/ExchangeComparison.tsx";
import { BalanceChart } from "@/components/charts/BalanceChart/index.ts";
import { PnLChart } from "@/components/charts/PnLChart/index.ts";
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
    renderTokenCell,
} from "@/components/tables/TableCellRenderer.tsx";
import { SwapDetailModal } from "@/components/wallet/SwapDetailModal/SwapDetailModal.tsx";
import WalletOverview from "@/components/wallet/WalletOverview/WalletOverview.tsx";
import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { locale } from "@/config/localization/index.ts";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
import { exportCurrentPageAsPdf } from "@/hooks/useChartExport.ts";
import { useGet } from "@/hooks/useGet";
import client from "@/api/main";
import { TokenAverageTradePrice, TokenDetailsDemo } from "./TokenDetailsDemo.tsx";
import { buildPortfolioMetaMap, mapPortfolioItems } from "../../util/wallet-portfolio-mapper.ts";
import { TokenIdentityCell } from "@/components/token/TokenIdentityCell.tsx";
import { Button } from "@carbon/react";
import { ChevronDown, Download } from "@carbon/icons-react";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import {
    fetchWalletCounterparties,
    fetchWalletPortfolio,
    fetchWalletSwaps,
    fetchWalletTransfers,
    type WalletCounterpartyRow,
    type WalletPageInfo,
    type WalletPortfolioItem,
    type WalletSwap,
    type WalletSwapTokenInfo,
    type WalletTransfer,
} from "@/services/wallet/walletApi.ts";
import styles from "./index.module.scss";

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

function PageSection({ children }: { children: ReactNode }) {
    return (
        <section className={styles.section}>
            <div className={styles.sectionStack}>{children}</div>
        </section>
    );
}

export default function WalletPage() {
    const { tr, fmt, lang } = useLocalization();
    const bcp47 = locale[lang].langCode;
    const navigate = useNavigate();
    const { address } = useParams<{ address: string }>();
    const walletAddress = address ?? "";

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

    const [activeTab, setActiveTab] = useState(0);
    const [isPagePdfExporting, setIsPagePdfExporting] = useState(false);
    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isDataExporting, setIsDataExporting] = useState(false);
    const [isChartsExporting, setIsChartsExporting] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement | null>(null);
    const pdfExportContainerRef = useRef<HTMLDivElement | null>(null);

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
        { enabled: !!address },
    );

    const tokenAddresses = useMemo(
        () => walletTokenDetails.data?.map((details) => details.tokenAddress).join(",") || null,
        [walletTokenDetails.data],
    );

    const tokenMeta = useGet(
        client.api.tokens.meta[":addresses"],
        200,
        { param: { addresses: tokenAddresses || "" } },
        {
            enabled: !!tokenAddresses,
            select: (data) => Object.fromEntries(data.map((item) => [item.address, item])),
        },
    );

    const tokenMarket = useGet(
        client.api.tokens.markets[":addresses"],
        200,
        { param: { addresses: tokenAddresses || "" } },
        { enabled: !!tokenAddresses },
    );

    const handleDividerMouseDown = useCallback((event: React.MouseEvent) => {
        event.preventDefault();
        isDragging.current = true;
        dragStartX.current = event.clientX;
        dragStartWidth.current = leftWidth;
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
    }, [leftWidth]);

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
    const loadedTransfers = useMemo(() => flattenLoadedPages(transferPages), [transferPages]);

    const transferByKey = useMemo(
        () => new Map(loadedTransfers.map((transfer) => [`${transfer.transactionSignature}:${transfer.instructionIndex}`, transfer])),
        [loadedTransfers],
    );

    const swapHasMore = useMemo(() => {
        const maxLoadedPage = getMaxLoadedPage(swapPages);
        return maxLoadedPage >= 1 ? Boolean(swapPageInfoByPage[maxLoadedPage]?.hasMore) : false;
    }, [swapPageInfoByPage, swapPages]);

    const transferHasMore = useMemo(() => {
        const maxLoadedPage = getMaxLoadedPage(transferPages);
        return maxLoadedPage >= 1 ? Boolean(transferPageInfoByPage[maxLoadedPage]?.hasMore) : false;
    }, [transferPageInfoByPage, transferPages]);

    const { rows: portfolioData, meta: portfolioMeta } = useMemo(() => mapPortfolioItems(portfolio), [portfolio]);
    const portfolioMetaMap = useMemo(() => buildPortfolioMetaMap(portfolioMeta), [portfolioMeta]);

    const balanceTokenOptions = useMemo(
        () => Array.from(new Set(portfolio.map((item) => item.symbol.trim().toUpperCase()).filter((symbol) => symbol.length > 0))).slice(0, 12),
        [portfolio],
    );


    const formatSwapPair = (swap: WalletSwap): string => {
        const tokensInvolved = typeof swap.tokensInvolved === "string" ? swap.tokensInvolved : String(swap.tokensInvolved ?? "");
        return tokensInvolved.replace(/,/g, " → ");
    };

    const toOptionalFiniteNumber = (value: unknown): number | undefined => {
        if (value == null) return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    };

    const swapData = useMemo(
        () => loadedSwaps.map((swap) => {
            const totalValueUsd = toOptionalFiniteNumber((swap as unknown as { totalValueUsd?: unknown }).totalValueUsd);
            const baseQuotePrice = toOptionalFiniteNumber((swap as unknown as { baseQuotePrice?: unknown }).baseQuotePrice);
            return [
                String(swap.blockTimestampIso ?? ""),
                typeof swap.exchangeName === "string" && swap.exchangeName.trim().length > 0 ? swap.exchangeName : "—",
                formatSwapPair(swap),
                swap.sold,
                swap.bought,
                totalValueUsd ?? "—",
                baseQuotePrice ?? "—",
                swap.transactionHash,
            ];
        }),
        [loadedSwaps],
    );

    const transferData = useMemo(
        () => loadedTransfers.map((transfer) => [
            transfer.from,
            transfer.to,
            typeof transfer.tokenSymbol === "string" && transfer.tokenSymbol.trim().length > 0 ? transfer.tokenSymbol : "Unknown",
            transfer.amount,
            transfer.timestamp,
            `${transfer.transactionSignature}:${transfer.instructionIndex}`,
        ]),
        [loadedTransfers],
    );

    const counterpartyTableData = useMemo(
        () => counterparties.map((row) => {
            const identityLabel =
                row.identity.name ||
                (row.identity.status === "known" ? tr("walletPage.identityKnown") : row.identity.status === "unavailable" ? tr("walletPage.identityUnavailable") : tr("walletPage.unknown"));
            return [row.address, identityLabel, row.uniqueTokenCount, row.tokens.join(", "), row.totalVolumeUsd, row.transactionCount];
        }),
        [counterparties, tr],
    );

    const counterpartyHeaders = [
        tr("walletPage.counterparties"),
        tr("walletPage.identity"),
        tr("walletPage.uniqueTokensTraded"),
        tr("walletPage.tokenList"),
        tr("walletPage.totalVolume"),
        tr("charts.counterpartyActivityChart.transactionCount"),
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

    const counterpartySortConfigs = { 2: { type: SortType.Number }, 4: { type: SortType.Number }, 5: { type: SortType.Number } };
    const swapSortConfigs = { 0: { type: SortType.Date }, 5: { type: SortType.Number }, 6: { type: SortType.Number } };
    const transferSortConfigs = { 3: { type: SortType.Number }, 4: { type: SortType.Date } };
    const portfolioSortConfig = { 1: { type: SortType.Number }, 2: { type: SortType.Number }, 3: { type: SortType.Number }, 4: { type: SortType.Number } };

    const counterpartyCellRenderers = [
        (value: string) => renderHash(value),
        (value: string) => renderCode(value),
        (value: string) => renderReducedNumber(value, renderBase, bcp47),
        (value: string) => renderCode(value),
        (value: string) => renderReducedNumber(value, renderCurrency, bcp47),
        (value: string) => renderReducedNumber(value, renderBase, bcp47),
    ];

    const renderSwapTokenInfoClassnames = { container: styles.swapTokenCell, amount: styles.swapTokenAmount };
    const swapCellRenderers = [
        (value: string) => renderDateTime(value, fmt.datetime["relative"]),
        (value: string) => renderCode(value),
        (value: string) => renderCode(value),
        (value: unknown, row?: unknown[] | null) => {
            if (!value || typeof value !== "object") return renderCode(String(value));
            const token = value as WalletSwapTokenInfo;
            return renderTokenCell(token, renderSwapTokenInfoClassnames, 18)(String(token.symbol ?? ""), row ?? null);
        },
        (value: unknown, row?: unknown[] | null) => {
            if (!value || typeof value !== "object") return renderCode(String(value));
            const token = value as WalletSwapTokenInfo;
            return renderTokenCell(token, renderSwapTokenInfoClassnames, 18)(String(token.symbol ?? ""), row ?? null);
        },
        (value: string) => (value === "—" ? renderBase(value) : renderReducedNumber(value, renderCurrency, bcp47)),
        (value: string) => renderReducedNumber(value, renderBase, bcp47),
    ];

    const transferCellRenderers = [
        (value: string) => renderHash(value),
        (value: string) => renderHash(value),
        (value: string, row?: unknown[] | null) => {
            if (!Array.isArray(row) || row.length < 6) return renderCode(value);
            const transferKey = String(row[5] ?? "");
            const transfer = transferByKey.get(transferKey);
            if (!transfer) return renderCode(value);
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

    const handleSwapPageChange = async (): Promise<boolean> => {
        if (!address || swapLoading) return false;
        const maxLoadedPage = getMaxLoadedPage(swapPages);
        if (maxLoadedPage < 1) return false;
        const previousPageInfo = swapPageInfoByPage[maxLoadedPage];
        if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor) return false;
        setSwapLoading(true);
        try {
            const response = await fetchWalletSwaps(address, { cursor: previousPageInfo.nextCursor, before: previousPageInfo.nextCursor });
            const nextRows = Array.isArray(response.swaps) ? response.swaps : [];
            const nextPage = maxLoadedPage + 1;
            setSwapPages((prev) => ({ ...prev, [nextPage]: nextRows }));
            setSwapPageInfoByPage((prev) => ({ ...prev, [nextPage]: response.pageInfo }));
            return nextRows.length > 0;
        } catch (error) {
            console.error("Failed to load wallet swap page", error);
            return false;
        } finally {
            setSwapLoading(false);
        }
    };

    const handleTransferPageChange = async (): Promise<boolean> => {
        if (!address || transferLoading) return false;
        const maxLoadedPage = getMaxLoadedPage(transferPages);
        if (maxLoadedPage < 1) return false;
        const previousPageInfo = transferPageInfoByPage[maxLoadedPage];
        if (!previousPageInfo?.hasMore || !previousPageInfo.nextCursor) return false;
        setTransferLoading(true);
        try {
            const response = await fetchWalletTransfers(address, { cursor: previousPageInfo.nextCursor });
            const nextRows = Array.isArray(response.transfers) ? response.transfers : [];
            const nextPage = maxLoadedPage + 1;
            setTransferPages((prev) => ({ ...prev, [nextPage]: nextRows }));
            setTransferPageInfoByPage((prev) => ({ ...prev, [nextPage]: response.pageInfo }));
            return nextRows.length > 0;
        } catch (error) {
            console.error("Failed to load wallet transfer page", error);
            return false;
        } finally {
            setTransferLoading(false);
        }
    };

    useEffect(() => {
        const loadData = async () => {
            if (!address || address === "null") return;
            setPortfolioLoading(true);
            setSwapLoading(true);
            setTransferLoading(true);
            setCounterpartyLoading(true);

            try {
                const [portfolioResult, swapsResult, transfersResult, counterpartiesResult] = await Promise.allSettled([
                    fetchWalletPortfolio(address),
                    fetchWalletSwaps(address),
                    fetchWalletTransfers(address),
                    fetchWalletCounterparties(address, { period: "7d", limit: 50, includeTokens: true }),
                ]);

                if (portfolioResult.status === "fulfilled" && Array.isArray(portfolioResult.value)) {
                    setPortfolio(portfolioResult.value);
                }

                if (swapsResult.status === "fulfilled") {
                    const swapsData = swapsResult.value?.swaps || [];
                    if (Array.isArray(swapsData)) {
                        setSwapPages({ 1: swapsData });
                        setSwapPageInfoByPage({ 1: swapsResult.value.pageInfo });
                    }
                }

                if (transfersResult.status === "fulfilled") {
                    const transfersData = transfersResult.value?.transfers || [];
                    if (Array.isArray(transfersData)) {
                        setTransferPages({ 1: transfersData });
                        setTransferPageInfoByPage({ 1: transfersResult.value.pageInfo });
                    }
                }

                if (counterpartiesResult.status === "fulfilled") {
                    const counterpartiesData = counterpartiesResult.value?.counterparties ?? [];
                    if (Array.isArray(counterpartiesData)) {
                        setCounterparties(counterpartiesData);
                    }
                }
            } finally {
                setPortfolioLoading(false);
                setSwapLoading(false);
                setTransferLoading(false);
                setCounterpartyLoading(false);
            }
        };

        loadData();
    }, [address]);

    async function handleExportPagePdf() {
        if (isPagePdfExporting) return;
        setIsPagePdfExporting(true);
        setIsExportMenuOpen(false);
        try {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            await exportCurrentPageAsPdf({
                baseFilename: `wallet-page-${address?.slice(0, 8) || "overview"}`,
                targetRef: pdfExportContainerRef,
            });
        } catch (error) {
            console.error("[WalletPage] Failed to export page PDF:", error);
        } finally {
            setIsPagePdfExporting(false);
        }
    }

    function handleExportDataXlsx() {
        try {
            setIsDataExporting(true);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([swapHeaders, ...swapData]), "Swaps");
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([transferHeaders, ...transferData]), "Transfers");
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([counterpartyHeaders, ...counterpartyTableData]), "Counterparties");
            XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([portfolioHeaders, ...portfolioData]), "Portfolio");
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
            if (canvases.length === 0) throw new Error("No chart images found to export");

            await Promise.all(canvases.map(async (canvas, index) => {
                const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((nextBlob) => resolve(nextBlob), "image/png"));
                if (blob) imagesFolder.file(`chart-${index + 1}.png`, blob);
            }));

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
            <PageSection >
                <div className={styles.chartStack}>
                    <div className={styles.chartSection}>
                        <BalanceChart minHeight={460} initialFilters={{ timePeriod: "7D", wallets: [walletAddress] }} tokenSelectorOptions={balanceTokenOptions.length > 0 ? balanceTokenOptions : ["SOL", "USDC", "USDT"]} autoRefresh />
                    </div>
                    <div className={styles.chartSection}>
                        <PnLChart minHeight={400} aggregation="daily" autoRefresh initialFilters={{ timePeriod: "7D", wallets: [walletAddress] }} />
                    </div>
                </div>
            </PageSection>
        </div>
    );

    const holdingsTab = (
        <div className={styles.tabPane}>
            <PageSection>
                <div className={styles.sectionStack}>
                    <div style={{ display: "flex" }}>
                        <div className={styles.chartSection} style={{ flex: 1 }}>
                            <AssetDistribution initialFilters={{ wallets: address ? [address] : [], timePeriod: "30D" }} autoRefresh />
                        </div>
                        <div className={styles.chartSection} style={{ flex: 1 }}>
                            <Table
                                maxHeight={400}
                                title={tr("walletPage.portfolio")}
                                headers={portfolioHeaders}
                                initialFilters={{}}
                                fetcher={Promise.resolve(portfolioData)}
                                filterSchema={portfolioFilterSchema}
                                cellRenderers={portfolioCellRenderers}
                                dataEntries={portfolioData}
                                isSortable={isSortablePortfolio}
                                sortConfigs={portfolioSortConfig}
                                onRowClick={(_row, rowIndex) => {
                                    const tokenAddress = rowIndex >= 0 ? portfolioMeta[rowIndex]?.tokenAddress : undefined;
                                    if (tokenAddress) {
                                        navigate(`/tokens/${tokenAddress}`);
                                    }
                                }}
                                loading={portfolioLoading && portfolioData.length === 0}
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
                <div className={styles.sectionStack}>
                    <div className={styles.chartSection}>
                        <CounterpartyActivity minHeight={320} initialFilters={{ timePeriod: "7D", wallets: [walletAddress] }} autoRefresh />
                    </div>
                    <div className={styles.chartSection}>
                        <ExchangeComparison walletAddress={walletAddress} />
                    </div>
                </div>
            </PageSection>

            <PageSection>
                <div className={styles.tableStack}>
                    <div className={styles.chartSection}>
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
                            onRowClick={(_row, rowIndex) => {
                                const swap = loadedSwaps[rowIndex >= 0 ? rowIndex : -1];
                                if (swap) {
                                    setSelectedSwap(swap);
                                    setSwapModalOpen(true);
                                }
                            }}
                            loading={swapLoading && loadedSwaps.length === 0}
                            serverPagination={{ enabled: true, hasMore: swapHasMore, isLoading: swapLoading, onPageChange: handleSwapPageChange }}
                        />
                    </div>
                    <div className={styles.chartSection}>
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
                            serverPagination={{ enabled: true, hasMore: transferHasMore, isLoading: transferLoading, onPageChange: handleTransferPageChange }}
                        />
                    </div>
                    <div className={styles.chartSection}>
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
                            onRowClick={(_row, rowIndex) => {
                                const counterpartyAddress = rowIndex >= 0 ? counterparties[rowIndex]?.address : undefined;
                                if (counterpartyAddress) {
                                    navigate(`/wallets/${counterpartyAddress}`);
                                }
                            }}
                            loading={counterpartyLoading && counterpartyTableData.length === 0}
                        />
                    </div>
                </div>
            </PageSection>
        </div>
    );

    const tabActions = (
        <div className={styles.exportMenuWrapper} ref={exportMenuRef}>
            <Button size="sm" kind="secondary" renderIcon={ChevronDown} onClick={() => setIsExportMenuOpen((prev) => !prev)} disabled={isPagePdfExporting || isDataExporting || isChartsExporting}>
                {tr("charts.export")}
            </Button>
            {isExportMenuOpen && (
                <div className={styles.exportMenu}>
                    <button type="button" className={styles.exportMenuItem} onClick={handleExportDataXlsx} disabled={isDataExporting}>
                        <Download size={16} />
                        {isDataExporting ? tr("walletPage.exportingData") : tr("walletPage.exportDataXlsx")}
                    </button>
                    <button type="button" className={styles.exportMenuItem} onClick={handleExportChartsZip} disabled={isChartsExporting}>
                        <Download size={16} />
                        {isChartsExporting ? tr("walletPage.exportingCharts") : tr("walletPage.exportChartsZip")}
                    </button>
                    <button type="button" className={styles.exportMenuItem} onClick={handleExportPagePdf} disabled={isPagePdfExporting}>
                        <Download size={16} />
                        {isPagePdfExporting ? tr("walletPage.exportingReport") : tr("walletPage.exportReportPdf")}
                    </button>
                </div>
            )}
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
            extraHeaderPanel={{
                isOpen: !!selectedToken,
                content: selectedToken && (
                    <TokenAverageTradePrice
                        walletAddress={address}
                        tokenAddress={selectedToken.address}
                        tokenImgUrl={tokenMeta.data?.[selectedToken.address]?.imageUrl || null}
                        tokenName={tokenMeta.data?.[selectedToken.address]?.name || null}
                        tokenSymbol={tokenMeta.data?.[selectedToken.address]?.symbol || null}
                        tokenCurrentPrice={tokenMarket.data?.[selectedToken.address]?.priceUsd || null}
                        avgBuyPrice={selectedToken.avgBuyCost}
                        avgSellPrice={selectedToken.avgSellCost}
                    />
                ),
                size: "lg",
                onClose: () => setSelectedToken(null),
            }}
        >
            <div ref={pdfExportContainerRef} className={styles.walletGrid} style={{ gridTemplateColumns: `${leftWidth}px 4px minmax(0, 1fr)` }}>
                <div className={styles.leftColumn}>
                    <WalletOverview walletAddress={walletAddress} />
                </div>

                <div className={styles.resizeDivider} onMouseDown={handleDividerMouseDown}>
                    <div className={styles.resizeHandle} />
                </div>

                <div className={styles.rightColumn}>
                    <div className={styles.rightContent}>
                        <TabContainer
                            activeTab={activeTab}
                            names={[tr("walletPage.overview"), tr("walletPage.holdings"), tr("walletPage.activityRisk")]}
                            tabs={[overviewTab, holdingsTab, activityTab]}
                            onTabChange={(index) => setActiveTab(index)}
                            actions={tabActions}
                        />
                    </div>
                </div>
            </div>

            <SwapDetailModal isOpen={swapModalOpen} onClose={() => setSwapModalOpen(false)} swap={selectedSwap} />
        </PageWrapper>
    );
}
