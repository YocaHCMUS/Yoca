import { useParams } from "react-router";
import { useState, useEffect } from "react";
import PageWrapper from "@/components/wrapper/PageWrapper";
import {
  TokenHeader,
  MarketStats,
  TopHolders,
  RecentTransactions,
  PoolSelector,
  TokenChart,
} from "@/components/token";
import type { MarketData, MetaData, PoolData, TopHoldersData } from "@/hooks/useTokenPageData";
import { useTokenPageLogic } from "@/hooks/useTokenPageLogic";
import styles from "./index.module.scss";

// Dev Step 2: Build UI with mock data

export default function TokenPage() {
  const { address, poolAddress } = useParams<{ address: string; poolAddress?: string }>();
  const {
    marketData,
    metaData,
    poolsData,
    topHolders,
    holdersInfo,
    selectedPool,
    trades,
    loading,
    handlePoolChange
  } = useTokenPageLogic(address, poolAddress);

  const [discordInvite, setDiscordInvite] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState<string | null>(null);
  const [twitterHandle, setTwitterHandle] = useState<string | null>(null);
  const [tokenAge, setTokenAge] = useState<string | null>(null);

  useEffect(() => {
    if (metaData?.coinGeckoId) {
      const fetchSocials = async () => {
        try {
          const response = await fetch(
            `https://api.coingecko.com/api/v3/coins/${metaData.coinGeckoId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
          );
          if (response.ok) {
            const data = await response.json();
            const chatUrls = data.links?.chat_url;
            if (Array.isArray(chatUrls)) {
              const discordUrl = chatUrls.find((url: string) =>
                url.includes("discord.com/invite/") ||
                url.includes("discord.gg/") ||
                url.includes("discordapp.com/invite/")
              );
              if (discordUrl) {
                const parts = discordUrl.split("/");
                const invite = parts[parts.length - 1];
                if (invite) setDiscordInvite(invite);
              }
            }

            // Website
            if (data.links?.homepage && Array.isArray(data.links.homepage) && data.links.homepage.length > 0) {
              setWebsiteUrl(data.links.homepage[0]);
            }

            // Twitter
            if (data.links?.twitter_screen_name) {
              setTwitterHandle(data.links.twitter_screen_name);
            }

            // Genesis Date / Token Age
            let genesisDateString = data.genesis_date;
            if (!genesisDateString && data.market_data) {
              // Fallback to earliest of ATL/ATH date if available
              const dates: number[] = [];
              if (data.market_data.atl_date?.usd) dates.push(new Date(data.market_data.atl_date.usd).getTime());
              if (data.market_data.ath_date?.usd) dates.push(new Date(data.market_data.ath_date.usd).getTime());

              if (dates.length > 0) {
                genesisDateString = new Date(Math.min(...dates)).toISOString();
              }
            }

            if (genesisDateString) {
              const genesisDate = new Date(genesisDateString);
              const now = new Date();
              const diffTime = Math.abs(now.getTime() - genesisDate.getTime());
              const diffMonthsFloat = diffTime / (1000 * 60 * 60 * 24 * 30.44);
              const diffYears = Math.floor(diffMonthsFloat / 12);

              if (diffYears >= 1) {
                setTokenAge(`>${diffYears}y`);
              } else {
                const diffMonths = Math.ceil(diffMonthsFloat);
                setTokenAge(`${diffMonths}m`);
              }
            }
          }
        } catch (error) {
          console.error("Failed to fetch social links", error);
        }
      };

      fetchSocials();
    } else {
      setDiscordInvite(null);
      setWebsiteUrl(null);
      setTwitterHandle(null);
      setTokenAge(null);
    }
  }, [metaData?.coinGeckoId]);

  if (!address) {
    return "Non existent page";
  }

  if (loading) {
    return <div className={styles.loadingContainer}>Is Loading ...</div>;
  }

  if (!metaData || !marketData) {
    return (
      <div className={styles.loadingContainer}>
        <p>Token data not found.</p>
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '8px' }}>
          The token might be new or not verified on CoinGecko.
          On-chain data fallback failed to retrieve pools.
        </p>
      </div>
    );
  }

  return (
    <PageWrapper>
      <div className={styles.tokenPageGrid}>
        {/* Left Column: Sidebar (Info, Stats, Holders) */}
        <div className={styles.leftColumn}>
          <div className={styles.sidebarGroup}>
            <TokenHeader
              name={metaData.name}
              symbol={metaData.symbol}
              address={metaData.address}
              imageUrl={metaData.imageUrl ?? undefined}
              coinGeckoId={metaData.coinGeckoId ?? null}
              discordInvite={discordInvite}
              websiteUrl={websiteUrl}
              twitterHandle={twitterHandle}
              tokenAge={tokenAge}
            />

            <PoolSelector
              pools={poolsData}
              selectedPool={selectedPool}
              onPoolChange={handlePoolChange}
            />

            {/* Vertical layout for sidebar */}
            <MarketStats
              data={marketData}
              pool={selectedPool}
              topHolders={topHolders}
              holdersInfo={holdersInfo}
              marketsCount={poolsData.length}
            />

            <TopHolders holders={topHolders} holdersInfo={holdersInfo} />
          </div>
        </div>

        {/* Right Column: Chart & Transactions */}
        <div className={styles.rightColumn}>
          <TokenChart pool={selectedPool} />

          {selectedPool && (
            <RecentTransactions
              trades={trades}
              baseTokenSymbol="SOL"
              tokenAddress={address}
              tokenSymbol={metaData.symbol}
              poolAddress={selectedPool?.address}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
