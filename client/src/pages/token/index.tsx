import { api } from "@/api/main";
import {
  MarketStats,
  PoolSelector,
  RecentTransactions,
  TokenChart,
  TokenHeader,
  TopHolders,
} from "@/components/token";
import PageWrapper from "@/components/wrapper/PageWrapper";
import { useGet } from "@/hooks/useGet";
import { useTokenPageLogic } from "@/hooks/useTokenPageLogic";
import { useState } from "react";
import { useParams } from "react-router";
import styles from "./index.module.scss";

export default function TokenPage() {
  const { address, poolAddress } = useParams<{
    address: string;
    poolAddress: string;
  }>();

  if (!address) {
    return <>Forgot to add address!</>;
  }

  const {
    marketData,
    poolsData,
    topHolders,
    holdersInfo,
    selectedPool,
    trades,
    loading,
    handlePoolChange,
  } = useTokenPageLogic(address, poolAddress);

  const [tokenAge, setTokenAge] = useState<string | null>(null);

  const $meta = useGet(api.tokens.meta[":addresses"], 200, {
    param: { addresses: address },
  });

  if ($meta.isLoading || loading) {
    return <>Loading</>;
  }
  if (!$meta.error || !$meta.data) {
    return <>Error</>;
  }

  const metaData = $meta.data[0];

  if (!address) {
    return "Non existent page";
  }

  if (!marketData) {
    return (
      <div className={styles.loadingContainer}>
        <p>Token data not found.</p>
        <p style={{ fontSize: "0.9rem", color: "#666", marginTop: "8px" }}>
          The token might be new or not verified on CoinGecko. On-chain data
          fallback failed to retrieve pools.
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
              discordInvite={metaData.linkDiscord}
              websiteUrl={metaData.linkHomepage}
              twitterHandle={metaData.twitterScreenName}
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
