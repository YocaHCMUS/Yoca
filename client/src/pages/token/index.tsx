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
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styles from "./index.module.scss";

function useTokenApi(address: string) {
  const meta = useGet(client.api.tokens.meta[":addresses"], 200, {
    param: { addresses: address },
  });

  const topPools = useGet(client.api.tokens[":address"].pools, 200, {
    param: { address },
  });

  const holders = useGet(client.api.tokens.holders[":address"], 200, {
    param: { address },
  });

  const holdersStats = useGet(
    client.api.tokens.holders.stats[":addresses"],
    200,
    { param: { addresses: address } },
  );

  const marketData = useGet(client.api.tokens.markets[":addresses"], 200, {
    param: { addresses: address },
  });

  return { meta, topPools, holders, holdersStats, marketData };
}

export default function TokenPage() {
  const navigate = useNavigate();

  const { address, poolAddress } = useParams<{
    address: string;
    poolAddress: string;
  }>();

  if (!address) {
    return <>Forgot to add address!</>;
  }

  const {
    meta: $meta,
    topPools: $topPools,
    holders: $holders,
    holdersStats: $holdersStats,
    marketData: $marketData,
  } = useTokenApi(address);

  const [selectedPoolAddress, setSelectedPoolAddress] = useState<string | null>(
    null,
  );

  useEffect(() => {
    console.log("refresh");
    if (poolAddress) {
      setSelectedPoolAddress(poolAddress);
    } else if (
      $topPools.data &&
      $topPools.data.length > 0 &&
      !selectedPoolAddress
    ) {
      setSelectedPoolAddress($topPools.data[0].data.poolAddress);
    }
  }, [$topPools.data, poolAddress]);

  const $trades = useGet(client.api.tokens.pools.trades[":address"], 200, {
    param: { address: selectedPoolAddress ?? "" },
  });

  const $selectedPoolData = useGet(client.api.tokens.pools[":addresses"], 200, {
    param: { addresses: selectedPoolAddress ?? "" },
  });

  if (!selectedPoolAddress) {
    return <>Not Selected</>;
  }

  const selectedPool = $selectedPoolData.data?.[0] ?? null;

  const handlePoolChange = ({
    selectedItem,
  }: {
    selectedItem: TopPoolData | null;
  }) => {
    if (selectedItem) {
      setSelectedPoolAddress(selectedItem.data.poolAddress);
      navigate(`/tokens/${address}/${selectedItem.data.poolAddress}`);
    }
  };

  const isLoading =
    $meta.isLoading ||
    $topPools.isLoading ||
    $holders.isLoading ||
    $holdersStats.isLoading ||
    $marketData.isLoading;

  if (isLoading) {
    return <>Loading</>;
  }
  if ($meta.error || !$meta.data) {
    return <>Error</>;
  }

  const [metaData] = $meta.data;

  // Prepare data for components
  const topPoolsData = $topPools.data ?? [];
  const topHolders = $holders.data ?? [];
  const holdersInfo = $holdersStats.data?.[0] ?? null;
  const marketData = $marketData.data?.[0] ?? null;
  const trades = $trades.data ?? [];

  // Find selected pool in top pools list for display
  const selectedTopPool =
    topPoolsData.find((p) => p.data.poolAddress == selectedPoolAddress) ?? null;

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
              pools={topPoolsData}
              selectedPool={selectedTopPool}
              onPoolChange={handlePoolChange}
            />

            {/* Vertical layout for sidebar */}
            <MarketStats
              data={marketData}
              pool={selectedPool}
              topHolders={topHolders}
              holdersInfo={holdersInfo}
              marketsCount={topPoolsData.length}
            />

            <TopHolders holders={topHolders} holdersInfo={holdersInfo} />
          </div>
        </div>

        {/* Right Column: Chart & Transactions */}
        <div className={styles.rightColumn}>
          <TokenChart pool={selectedPool} />

          {selectedPool && (
            <RecentTransactions
              trades={trades.map((trade) => {
                const kind = trade.buyTokenAddress == address ? "buy" : "sell";
                const amount =
                  kind == "buy" ? trade.buyTokenAmount : trade.sellTokenAmount;
                const priceUsd =
                  kind == "buy"
                    ? trade.buyTokenPriceUsd
                    : trade.sellTokenPriceUsd;
                const priceQuote =
                  kind == "buy"
                    ? trade.buyTokenPriceUsd
                    : trade.sellTokenPriceUsd;

                return {
                  kind,
                  amount: amount.toString(),
                  fromAddress: trade.signerAddress,
                  id: trade.id,
                  timestamp: trade.blockTimestamp,
                  txHash: trade.transactionHash,
                  volumeUsd: trade.volumeInUsd.toString(),
                  priceUsd: priceUsd.toString(),
                  priceQuote: priceQuote.toString(),
                };
              })}
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
