import client from "@/api/main";
import {
    GlobalPrices,
    TokenHeader,
    TokenInsightTabs,
    TokenMarketsTable,
    TokenOverviewChart,
    TokenOverviewStats,
    TokenTabs,
} from "@/components/token";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { useRef, useState } from "react";
import { useParams } from "react-router";
import styles from "./index.module.scss";

function useTokenOverviewData(address: string) {
  const baseMeta = useGet(client.api.tokens.meta[":addresses"], 200, {
    param: { addresses: address },
  });

  const holders = useGet(client.api.tokens.holders[":address"], 200, {
    param: { address },
  });

  const holdersStats = useGet(
    client.api.tokens.holders.stats[":addresses"],
    200,
    {
      param: { addresses: address },
    },
  );

  const marketData = useGet(client.api.tokens.markets[":addresses"], 200, {
    param: { addresses: address },
  });

  const isLoading = baseMeta.isLoading || marketData.isLoading;
  const error = baseMeta.error || marketData.error;

  // If we have no data at all yet, return null
  if (!baseMeta.data || !marketData.data) {
    return {
      isLoading,
      isFirstLoad: true,
      error,
      data: null as null,
    };
  }

  // Safe unwrap — data có thể là stale (token cũ) do keepPreviousData
  const [meta] = baseMeta.data;
  const [holdersInfo] = holdersStats.data ?? [null];

  return {
    isLoading,
    isFirstLoad: false,
    error: null,
    data: {
      meta,
      holders: holders.data ?? [],
      holdersInfo,
      market: marketData.data?.[address] ?? null,
    },
  };
}

export default function TokenOverviewPage() {
  const { address } = useParams<{
    address: string;
  }>();

  const [activeTab, setActiveTab] = useState("overview");

  const [customPriceChange, setCustomPriceChange] = useState<{
    percentage: number | null;
    label: string;
  } | null>(null);

  const overviewRef = useRef<HTMLDivElement>(null);
  const marketsRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    let targetRef: any = null;
    switch (tabId) {
      case "overview":
        targetRef = overviewRef;
        break;
      case "markets":
        targetRef = marketsRef;
        break;
    }
    if (targetRef?.current) {
      const container = targetRef.current.parentElement;
      if (container) {
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = targetRef.current.getBoundingClientRect().top;
        container.scrollBy({
          top: targetTop - containerTop - 24, // Adjust for the 24px padding
          behavior: "smooth",
        });
      }
    }
  };

  if (!address) {
    return <>Missing token address</>;
  }

  const result = useTokenOverviewData(address);

  // ── Sticky data: update ĐỒNG BỘ trong lúc render (không dùng useEffect) ──
  // Đảm bảo cột trái luôn hiện data gần nhất, không bao giờ trắng
  const freshMeta = result.data?.meta ?? null;
  const freshMarket = result.data?.market ?? null;

  const stickyMetaRef = useRef(freshMeta);
  const stickyMarketRef = useRef(freshMarket);

  // Cập nhật ngay trong render — không cần đợi effect cycle
  if (freshMeta) stickyMetaRef.current = freshMeta;
  if (freshMarket) stickyMarketRef.current = freshMarket;

  const meta = stickyMetaRef.current;
  const market = stickyMarketRef.current;
  const { tr } = useLocalization();

  return (
    <PageWrapper>
      <div className={styles.tokenOverviewGrid}>
        <div className={styles.leftColumn}>
          <div className={styles.sidebarGroup}>
            {!meta ? (
              <div className={styles.skeletonHeader}>
                <div className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} />
                <div className={styles.skeletonLines}>
                  <div className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineLong}`} />
                  <div className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  <div className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
                </div>
              </div>
            ) : (
              <TokenHeader
                name={meta.name}
                symbol={meta.symbol}
                address={meta.address}
                imageUrl={meta.imageUrl ?? undefined}
                coinGeckoId={meta.coingeckoId ?? null}
                discordInvite={meta.linkDiscord}
                websiteUrl={meta.linkHomepage}
                twitterHandle={meta.twitterScreenName}
                marketCapRank={market?.marketCapRank ?? null}
                compact
              />
            )}

            {!market ? (
              <div className={styles.skeletonStats}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={styles.skeletonStatRow}>
                    <div className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
                    <div className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineShort}`} />
                  </div>
                ))}
              </div>
            ) : (
              <TokenOverviewStats
                meta={meta! as any}
                data={market}
                customPriceChange={customPriceChange}
              />
            )}
          </div>
        </div>

        <div className={styles.rightColumn}>
          <div className={styles.rightHeader}>
            <TokenTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              symbol={meta?.symbol ?? "—"}
              address={address}
            />
          </div>

          <div className={styles.rightContent}>
            <div ref={overviewRef} className={styles.scrollAnchor}>
              {address && (
                <TokenOverviewChart
                  address={address}
                  symbol={meta?.symbol ?? ""}
                  onPriceChangeUpdate={setCustomPriceChange}
                />
              )}
            </div>

            {/* About / Holders insight tabs — right below chart */}
            <div className={styles.marketsSection}>
              <TokenInsightTabs
                address={address}
                meta={{
                  name: meta?.name ?? "",
                  symbol: meta?.symbol ?? "",
                  description: (result.data?.meta as any)?.description ?? null,
                }}
                market={market}
                holders={result.data?.holders ?? []}
                holdersInfo={result.data?.holdersInfo ?? null}
                holdersLoading={result.isFirstLoad}
              />
            </div>

            <div
              ref={marketsRef}
              className={`${styles.marketsSection} ${styles.scrollAnchor}`}
            >
              <div className={styles.marketsSectionTitle}>
                {meta?.name ?? "—"} Markets
              </div>
              <div className={styles.marketsSectionDescription}>
                Top decentralized exchange pools for trading {meta?.name ?? "this token"}.
              </div>
              {address && <TokenMarketsTable address={address} symbol={meta?.symbol ?? ""} />}
            </div>

            {market?.priceUsd != null && (
              <div className={styles.marketsSection}>
                <div className={styles.marketsSectionTitle}>
                  {tr("token.globalPrices.title", { name: meta?.name ?? "—" })}
                </div>
                <div className={styles.marketsSectionDescription}>
                  {tr("token.globalPrices.description", { name: meta?.name ?? "This token" })}
                </div>
                <GlobalPrices
                  priceUsd={market.priceUsd}
                  symbol={meta?.symbol ?? ""}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
