import client from "@/api/main";
import { Card } from "@/components/common/Card/Card";
import { PnLChart } from "@/components/charts/PnLChart/index.ts";
import { WalletTopbar } from "@/components/wallet/WalletTopbar/WalletTopbar.tsx";
import { WalletHero } from "@/components/wallet/WalletHero/WalletHero.tsx";
import { WalletHoldingsPanel } from "@/components/wallet/WalletHoldingsPanel/WalletHoldingsPanel.tsx";
import { RightSidebar } from "./RightSidebar.tsx";
import {
  WalletChat,
  ChatContextProvider,
} from "@/components/wallet/WalletChat";
import { AiAnalysisModal } from "@/components/wallet/AiAnalysisModal/AiAnalysisModal.tsx";
import { useWalletWinrate } from "@/hooks/useWalletWinrate";

import { PageWrapper } from "@/components/wrapper/PageWrapper.tsx";
import { useLocalization } from "@/contexts/LocalizationContext.tsx";
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
} from "@/services/wallet/walletApi.ts";
import { fetchWalletTags } from "@/services/wallet/walletTagsApi.ts";
import { AiGenerate, Close } from "@carbon/icons-react";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useParams } from "react-router";

import { mapPortfolioItems } from "../../util/wallet-portfolio-mapper.ts";
import styles from "./index.module.scss";
import {
  TokenAverageTradePrice,
  TokenDetailsDemo,
} from "./TokenDetailsDemo.tsx";
// import { BalanceChart } from "@/components/charts/BalanceChart/BalanceChart.tsx";
import { DayActivityPopup } from "@/components/wallet/DayActivityPopup/DayActivityPopup.tsx";
import { AiSwapSummaryModal } from "@/components/wallet/AiSwapSummaryModal";
import { BalanceChartV2 } from "@/components/charts/BalanceChartV2/BalanceChartV2.tsx";
import type { WalletOverviewPeriodKey } from "@/services/wallet/walletApi.ts";
import { WalletTransactionActivity } from "@/components/WalletTransactionActivity/WalletTransactionActivity";

type ChatPosition = "right" | "left" | "fullscreen";

function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return (
    target.isContentEditable ||
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select"
  );
}

export default function WalletPage() {
  const { tr, lang } = useLocalization();
  const { address } = useParams<{ address: string }>();
  const walletAddress = address ?? "";

  const [, setSwapPages] = useState<Record<number, WalletSwap[]>>({});
  const [, setSwapPageInfoByPage] = useState<
    Record<number, WalletPageInfo>
  >({});
  const [, setSwapLoading] = useState(false);

  const [, setTransferPages] = useState<
    Record<number, WalletTransfer[]>
  >({});
  const [, setTransferPageInfoByPage] = useState<
    Record<number, WalletPageInfo>
  >({});
  const [, setTransferLoading] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const [portfolio, setPortfolio] = useState<WalletPortfolioItem[]>([]);
  const [overviewReport, setOverviewReport] =
    useState<WalletOverviewMultiPeriodResponse | null>(null);
  const [, setIntelligenceReport] =
    useState<WalletIntelligenceResponse | null>(null);
  const [, setWalletTags] = useState<string[]>([]);

  const [selectedPeriod, setSelectedPeriod] =
    useState<WalletOverviewPeriodKey>("24H");
  const [aiAnalysisOpen, setAiAnalysisOpen] = useState(false);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatPosition, setChatPosition] = useState<ChatPosition>("right");



  const { stats, loading } = useWalletWinrate(
    walletAddress,
    selectedPeriod,
  );
  const [selectedToken, setSelectedToken] = useState<{
    address: string;
    symbol: string;
    avgBuyCost: number;
    avgSellCost: number;
  } | null>(null);

  useEffect(() => {
    if (!selectedToken) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedToken(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedToken]);

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

  const [dayPopupOpen, setDayPopupOpen] = useState(false);
  const [dayPopupTimestamp, setDayPopupTimestamp] = useState(0);

  const [aiSwapSummaryOpen, setAiSwapSummaryOpen] = useState(false);

  const { meta: portfolioMeta } = useMemo(
    () => mapPortfolioItems(portfolio),
    [portfolio],
  );
  const portfolioMetaAsMap = useMemo(() => {
    const map = new Map<
      number,
      { tokenAddress: string; logoUri: string | null; fullName: string | null }
    >();
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
  useEffect(() => {
    const handleChatShortcut = (event: globalThis.KeyboardEvent) => {
      if (
        event.repeat ||
        !event.shiftKey ||
        event.code !== "Slash" ||
        isEditableShortcutTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      setIsChatOpen(true);
    };

    window.addEventListener("keydown", handleChatShortcut);
    return () => window.removeEventListener("keydown", handleChatShortcut);
  }, []);
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
      .catch((err) =>
        console.error("[WalletPage] Failed to load overview:", err),
      );

    fetchWalletIntelligence(address, "solana")
      .then(setIntelligenceReport)
      .catch((err) =>
        console.error("[WalletPage] Failed to load intelligence:", err),
      );
  }, [address, loadPortfolioData, loadActivityData]);




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
      wideContent
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
      <div className={`${styles.pageLayout}${isRightSidebarOpen ? ` ${styles.rightSidebarExpanded}` : ''}`}>
        <div className={styles.shell}>
          {/* <PageHeader
            eyebrow="Wallet Intelligence"
            title="Wallet Detail"
            subtitle="Track holdings, capital flow, trading performance, and recent on-chain activity for this address."
          /> */}

          <WalletTopbar
            address={walletAddress}
            onAiAnalysisOpen={() => setAiAnalysisOpen(true)}
            currentPeriod={selectedPeriod}
            onPeriodChange={(period) => setSelectedPeriod(period)}
          />

          <WalletHero
            overview={overviewReport}
            selectedPeriod={selectedPeriod}
            loading={false}
            winRateStats={stats}
            winRateLoading={loading}
          />

          <div className={styles.body}>
            <main className={styles.mainCol}>
              {/* Balance History */}
              <Card>
                <BalanceChartV2
                  minHeight={324}
                  address={walletAddress}
                  onClickDay={(ts) => {
                    setDayPopupTimestamp(ts);
                    setDayPopupOpen(true);
                  }}
                />
              </Card>

              {/* Profit & Loss */}
              <Card>
                <PnLChart
                  minHeight={324}
                  initialFilters={{ wallets: [walletAddress] }}
                  onDayClick={(_wallet, ts) => {
                    setDayPopupTimestamp(ts);
                    setDayPopupOpen(true);
                  }}
                />
              </Card>

              {/* Activity Tables */}
              <Card>
                <WalletTransactionActivity address={walletAddress} />
              </Card>
            </main>

            <aside className={styles.sideCol}>
              <Card>
                <WalletHoldingsPanel
                  walletAddress={walletAddress}
                  portfolio={portfolio}
                  portfolioMeta={portfolioMetaAsMap}
                  loading={portfolioLoading}
                />
              </Card>
            </aside>
          </div>

          <section className={styles.tokenDetailsWrapper}>
            <TokenDetailsDemo setSelectedToken={setSelectedToken} />
          </section>
        </div>

        {/* Modal chat panel (right/left dock + fullscreen) */}
        <ChatContextProvider
          addresses={[walletAddress]}
          contextType="wallet"
          lang={lang}
        >
          {!isChatOpen && (
            <button
              type="button"
              className={styles.chatLauncher}
              onClick={() => setIsChatOpen(true)}
              title={tr("chat.shortcutHint")}
            >
              <AiGenerate size={18} />
              <span>{tr("chat.launcherLabel")}</span>
              <kbd>{tr("chat.shortcutHint")}</kbd>
            </button>
          )}

          <RightSidebar
            onToggle={setIsRightSidebarOpen}
            isChatOpen={isChatOpen}
            onChatToggle={() => setIsChatOpen((v) => !v)}
          />

          {isChatOpen && (
            <div className={styles.chatOverlay} data-position={chatPosition}>
              <div className={styles.chatPanel}>
                <WalletChat
                  variant="sidebar"
                  chatPosition={chatPosition}
                  onChatPositionChange={setChatPosition}
                  onRequestClose={() => setIsChatOpen(false)}
                />
              </div>
            </div>
          )}

        </ChatContextProvider>

        {selectedToken && (
          <div
            className={styles.tokenGraphOverlay}
            role="presentation"
            onClick={() => setSelectedToken(null)}
          >
            <aside
              className={styles.tokenGraphPanel}
              aria-label={tr("walletPage.averageTradingPrice")}
              onClick={(event) => event.stopPropagation()}
            >
              <div className={styles.tokenGraphHeader}>
                <div>
                  <span className={styles.tokenGraphEyebrow}>
                    {tr("walletPage.graph")}
                  </span>
                  <h2 className={styles.tokenGraphTitle}>
                    {tr("walletPage.averageTradingPrice")}
                  </h2>
                </div>
                <button
                  type="button"
                  className={styles.tokenGraphCloseBtn}
                  aria-label={tr("common.cancel")}
                  onClick={() => setSelectedToken(null)}
                >
                  <Close size={20} />
                </button>
              </div>

              <div className={styles.tokenGraphContent}>
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
              </div>
            </aside>
          </div>
        )}
      </div>

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
    </PageWrapper>
  );
}
