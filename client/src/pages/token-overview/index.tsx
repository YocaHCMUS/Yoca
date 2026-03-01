import { client } from "@/api/main";
import {
    TokenHeader,
    TokenMarketsTable,
    TokenOverviewChart,
    TokenOverviewStats,
    TrendingCoins,
    TokenTabs,
} from "@/components/token";
import PageWrapper from "@/components/wrapper/PageWrapper";
import { useGet } from "@/hooks/useGet";
import { useParams } from "react-router";
import { useState, useRef } from "react";
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

    const isLoading =
        baseMeta.isLoading ||
        marketData.isLoading;

    // Only block on critical data errors, not holders (which depends on Moralis API)
    const error =
        baseMeta.error ||
        marketData.error;

    if (isLoading || error) {
        return {
            isLoading,
            error,
            data: null as null,
        };
    }

    // Safe unwrap after loading/error gate
    const [meta] = baseMeta.data!;
    const [holdersInfo] = holdersStats.data ?? [null];

    return {
        isLoading: false,
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

    const overviewRef = useRef<HTMLDivElement>(null);
    const marketsRef = useRef<HTMLDivElement>(null);
    const trendingRef = useRef<HTMLDivElement>(null);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        let targetRef: any = null;
        switch (tabId) {
            case "overview": targetRef = overviewRef; break;
            case "markets": targetRef = marketsRef; break;
            case "trending": targetRef = trendingRef; break;
        }
        if (targetRef?.current) {
            targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    if (!address) {
        return <>Missing token address</>;
    }

    const result = useTokenOverviewData(address);

    if (result.isLoading) {
        return <>Loading</>;
    }

    if (result.error || !result.data) {
        return <>Error</>;
    }

    const { meta, market } = result.data;

    return (
        <PageWrapper>
            <div className={styles.tokenOverviewGrid}>
                <div className={styles.leftColumn}>
                    <div className={styles.sidebarGroup}>
                        <TokenHeader
                            name={meta.name}
                            symbol={meta.symbol}
                            address={meta.address}
                            imageUrl={meta.imageUrl ?? undefined}
                            coinGeckoId={meta.coingeckoId ?? null}
                            discordInvite={meta.linkDiscord}
                            websiteUrl={meta.linkHomepage}
                            twitterHandle={meta.twitterScreenName}
                        />

                        <TokenOverviewStats
                            meta={meta}
                            data={market}
                        />
                    </div>
                </div>

                <div className={styles.rightColumn}>
                    <div className={styles.rightHeader}>
                        <TokenTabs activeTab={activeTab} onTabChange={handleTabChange} symbol={meta.symbol} />
                    </div>

                    <div className={styles.rightContent}>
                        <div ref={overviewRef} className={styles.scrollAnchor}>
                            <TokenOverviewChart
                                address={address}
                                symbol={meta.symbol}
                            />
                        </div>

                        <div ref={marketsRef} className={`${styles.marketsSection} ${styles.scrollAnchor}`}>
                            <div className={styles.marketsSectionTitle}>
                                {meta.name} Markets
                            </div>
                            <TokenMarketsTable
                                address={address}
                                symbol={meta.symbol}
                            />
                        </div>
                        <div ref={trendingRef} className={`${styles.marketsSection} ${styles.scrollAnchor}`}>
                            <div className={styles.marketsSectionTitle}>
                                Trending Coins
                            </div>
                            <TrendingCoins />
                        </div>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
}
