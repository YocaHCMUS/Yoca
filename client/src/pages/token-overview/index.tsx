import client from "@/api/main";
import {
  GlobalPrices,
  NewsTab,
  TokenAIChat,
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
  const tokenDetails = useGet(
    client.api.tokens.details[":addresses"],
    200,
    {
      param: {
        addresses: address,
      },
    },
    {
      select: (data) => ({
        ...data[0].meta,
        ...data[0].details,
      }),
    },
  );

  const holders = useGet(client.api.tokens.holders[":address"], 200, {
    param: { address },
  });

  const marketData = useGet(client.api.tokens.markets[":addresses"], 200, {
    param: { addresses: address },
  });

  const isLoading = tokenDetails.isLoading || marketData.isLoading;
  const error = tokenDetails.error || marketData.error;

  if (!tokenDetails.data || !marketData.data) {
    return {
      isLoading,
      isFirstLoad: true,
      error,
      data: null as null,
    };
  }

  const details = Array.isArray(tokenDetails.data)
    ? tokenDetails.data[0] ?? null
    : tokenDetails.data ?? null;

  return {
    isLoading,
    isFirstLoad: false,
    error: null,
    data: {
      details,
      holders: holders.data ?? [],
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
  const newsRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    const sectionRefs = {
      overview: overviewRef,
      markets: marketsRef,
      news: newsRef,
    };
    sectionRefs[tabId as keyof typeof sectionRefs]?.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  if (!address) {
    return <>Missing token address</>;
  }

  const result = useTokenOverviewData(address);
  const { tr } = useLocalization();
  const details = result.data?.details;
  const market = result.data?.market;

  return (
    <PageWrapper>
      <div className={styles.tokenOverviewPage}>
        <header className={styles.pageHero}>
          <div className={styles.pageHeroEyebrow}>Token Intelligence</div>
          <div className={styles.pageHeroBody}>
            <h1 className={styles.pageHeroTitle}>
              {details?.name ?? "Token Overview"}
            </h1>
            <p className={styles.pageHeroDescription}>
              Live price, market structure, holders, news, and AI context for
              this token.
            </p>
          </div>
        </header>

        <div className={styles.tokenOverviewGrid}>
          <div className={styles.leftColumn}>
            <div className={styles.sidebarGroup}>
              {!details ? (
                <div className={styles.skeletonHeader}>
                  <div
                    className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`}
                  />
                  <div className={styles.skeletonLines}>
                    <div
                      className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineLong}`}
                    />
                    <div
                      className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineShort}`}
                    />
                    <div
                      className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineMedium}`}
                    />
                  </div>
                </div>
              ) : (
                <TokenHeader
                  name={details.name}
                  symbol={details.symbol}
                  address={details.address}
                  imageUrl={details.imageUrl ?? undefined}
                  coinGeckoId={details.coingeckoId ?? ""}
                  discordInvite={details.linkDiscord}
                  websiteUrl={details.linkHomepage}
                  twitterHandle={details.twitterScreenName}
                  marketCapRank={null}
                  compact
                />
              )}

              {!market || !details ? (
                <div className={styles.skeletonStats}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className={styles.skeletonStatRow}>
                      <div
                        className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineMedium}`}
                      />
                      <div
                        className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineShort}`}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <TokenOverviewStats
                  meta={details}
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
                symbol={details?.symbol ?? "-"}
                address={address}
              />
            </div>

            <div className={styles.rightContent}>
              <div
                id="token-overview"
                ref={overviewRef}
                className={styles.scrollAnchor}
              >
                {address && (
                  <TokenOverviewChart
                    address={address}
                    symbol={details?.symbol ?? ""}
                    name={details?.name ?? ""}
                    onPriceChangeUpdate={setCustomPriceChange}
                  />
                )}
              </div>

              <div className={styles.marketsSection}>
                <TokenInsightTabs
                  address={address}
                  meta={{
                    name: details?.name ?? "",
                    symbol: details?.symbol ?? "",
                    description: details?.description ?? null,
                  }}
                  market={market ?? null}
                  holders={result.data?.holders ?? []}
                  holdersLoading={result.isFirstLoad}
                />
              </div>

              <div className={styles.marketsSection}>
                <TokenAIChat
                  address={address}
                  symbol={details?.symbol ?? undefined}
                  name={details?.name ?? undefined}
                  timeframe="24h"
                />
              </div>

              <div
                id="token-markets"
                ref={marketsRef}
                className={`${styles.marketsSection} ${styles.scrollAnchor}`}
              >
                <div className={styles.marketsSectionTitle}>
                  {details?.name ?? "-"} Markets
                </div>
                <div className={styles.marketsSectionDescription}>
                  Top decentralized exchange pools for trading{" "}
                  {details?.name ?? "this token"}.
                </div>
                {address && (
                  <TokenMarketsTable
                    address={address}
                    symbol={details?.symbol ?? ""}
                  />
                )}
              </div>

              {market?.priceUsd != null && (
                <div className={styles.marketsSection}>
                  <div className={styles.marketsSectionTitle}>
                    {tr("token.globalPrices.title", {
                      name: details?.name ?? "-",
                    })}
                  </div>
                  <div className={styles.marketsSectionDescription}>
                    {tr("token.globalPrices.description", {
                      name: details?.name ?? "This token",
                    })}
                  </div>
                  <GlobalPrices
                    priceUsd={market.priceUsd}
                    symbol={details?.symbol ?? ""}
                  />
                </div>
              )}

              <div
                id="token-news"
                ref={newsRef}
                className={`${styles.marketsSection} ${styles.scrollAnchor}`}
              >
                {address && details && (
                  <NewsTab
                    address={address}
                    symbol={details.symbol ?? ""}
                    name={details.name ?? ""}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
