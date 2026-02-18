import { client } from "@/api/main";
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
import type { InferResponseType } from "hono/client";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styles from "./index.module.scss";

type PoolData = InferResponseType<
  typeof client.api.tokens.pools[":addresses"]["$get"],
  200
>[number];

export default function TokenPage() {
  const navigate = useNavigate();
  const { address, poolAddress } = useParams<{
    address: string;
    poolAddress: string;
  }>();

  if (!address) {
    return <>Forgot to add address!</>;
  }

  // Fetch all data using useGet hooks
  const $meta = useGet(client.api.tokens.meta[":addresses"], 200, {
    param: { addresses: address },
  });

  const $pools = useGet(client.api.tokens[":address"].pools, 200, {
    param: { address },
  });

  // Fetch detailed pool data for all pools
  const poolAddresses =
    $pools.data?.map((p: { poolAddress: string }) => p.poolAddress).join(",") ?? "";
  const $poolsData = useGet(client.api.tokens.pools[":addresses"], 200, {
    param: { addresses: poolAddresses || "none" },
  });

  // Local state for selected pool
  const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(
    null
  );

  // Auto-select pool from URL or first available pool
  useEffect(() => {
    if (poolAddress) {
      setSelectedPoolAddress(poolAddress);
    } else if (
      $poolsData.data &&
      $poolsData.data.length > 0 &&
      !selectedPoolAddress
    ) {
      setSelectedPoolAddress($poolsData.data[0].poolAddress);
    }
  }, [$poolsData.data, poolAddress, selectedPoolAddress]);

  // Find the selected pool object
  const selectedPool =
    $poolsData.data?.find((p: PoolData) => p.poolAddress === selectedPoolAddress) ?? null;

  // Fetch pool trades
  const $trades = useGet(client.api.tokens.pools.trades[":address"], 200, {
    param: { address: selectedPoolAddress || "none" },
  });

  // Fetch holders data
  const $holders = useGet(client.api.tokens.holders[":address"], 200, {
    param: { address },
  });

  const $holdersStats = useGet(client.api.tokens.holders.stats[":addresses"], 200, {
    param: { addresses: address },
  });

  // Fetch market data
  const $marketData = useGet(client.api.tokens.markets[":addresses"], 200, {
    param: { addresses: address },
  });

  // Handler for pool selection
  const handlePoolChange = ({ selectedItem }: { selectedItem: PoolData | null }) => {
    if (selectedItem) {
      setSelectedPoolAddress(selectedItem.poolAddress);
      navigate(`/tokens/${address}/${selectedItem.poolAddress}`);
    }
  };

  // Check loading states
  const isLoading = $meta.isLoading || $pools.isLoading || $holders.isLoading || $holdersStats.isLoading || $marketData.isLoading;

  if (isLoading) {
    return <>Loading</>;
  }
  if ($meta.error || !$meta.data) {
    return <>Error</>;
  }

  const [metaData] = $meta.data;

  // Prepare data for components
  const poolsData = $poolsData.data ?? [];
  const topHolders = $holders.data ?? [];
  const holdersInfo = $holdersStats.data?.[0] ?? null;
  const marketData = $marketData.data?.[0] ?? null;
  const trades = $trades.data ?? [];

  if (!address) {
    return "Non existent page";
  }

  if (!metaData) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#999" }}>
        <p>No metadata found for this token.</p>
        <p style={{ fontSize: "0.9rem", marginTop: "8px" }}>
          Address: {address}
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
              coinGeckoId={metaData.coingeckoId ?? null}
              discordInvite={metaData.linkDiscord}
              websiteUrl={metaData.linkHomepage}
              twitterHandle={metaData.twitterScreenName}
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
              poolAddress={selectedPool.poolAddress}
            />
          )}
        </div>
      </div>
    </PageWrapper>
  );
}
