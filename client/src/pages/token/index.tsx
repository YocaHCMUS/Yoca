import client from "@/api/main";
import {
  MarketStats,
  PoolSelector,
  RecentTransactions,
  TokenChart,
  TokenHeader,
  TopHolders,
} from "@/components/token";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useGet } from "@/hooks/useGet";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styles from "./index.module.scss";

function useTokenPageData(address: string, poolAddress: string) {
  const baseMeta = useGet(
    client.api.tokens.details[":addresses"],
    200,
    {
      param: { addresses: address },
    },
    {
      select: (dataArr) =>
        dataArr.map((data) => ({
          ...data.meta,
          ...data.details,
        })),
    },
  );

  const topPools = useGet(client.api.tokens[":address"].pools, 200, {
    param: { address },
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

  const trades = useGet(client.api.tokens.pools.trades[":address"], 200, {
    param: { address: poolAddress },
  });

  const poolData = useGet(client.api.tokens.pools[":addresses"], 200, {
    param: { addresses: poolAddress },
  });

  const isLoading =
    baseMeta.isLoading ||
    topPools.isLoading ||
    marketData.isLoading ||
    trades.isLoading ||
    poolData.isLoading;

  // Only block on critical data errors, not holders (which depends on Moralis API)
  const error =
    baseMeta.error ||
    topPools.error ||
    marketData.error ||
    trades.error ||
    poolData.error;

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
  const pool = poolData.data?.[0] ?? null;

  return {
    isLoading: false,
    error: null,
    data: {
      meta,
      topPools: topPools.data!,
      holders: holders.data ?? [],
      holdersInfo,
      market: marketData.data?.[address] ?? null,
      trades: trades.data!,
      pool,
    },
  };
}

export default function TokenPage() {
  const navigate = useNavigate();

  const { address, poolAddress } = useParams<{
    address: string;
    poolAddress: string;
  }>();

  if (!address || !poolAddress) {
    return <>Forgot to add address!</>;
  }

  const result = useTokenPageData(address, poolAddress);

  const [pairData, setPairData] = useState<
    NonNullable<typeof result.data>["pool"] | null
  >(null);

  useEffect(() => {
    setPairData(null);
  }, [poolAddress]);

  useEffect(() => {
    const nextPool = result.data?.pool ?? null;
    if (!nextPool) {
      return;
    }

    if (nextPool.poolAddress === poolAddress) {
      setPairData(nextPool);
    }
  }, [poolAddress, result.data?.pool]);

  if (poolAddress && !result.error && (result.isLoading || !pairData)) {
    return <>Loading</>;
  }

  if (result.isLoading) {
    return <>Loading</>;
  }

  if (result.error || !result.data) {
    return <>Error</>;
  }

  const { meta, topPools, holders, holdersInfo, market, trades } =
    result.data;
  const pool = pairData;

  if (!pool) {
    return <>Loading</>;
  }

  return (
    <PageWrapper>
      <div className={styles.tokenPageGrid}>
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

            <PoolSelector
              pools={topPools.map((p) => ({
                dexId: p.data.dexId,
                poolAddress: p.data.poolAddress,
                poolName: p.data.poolName,
                liquidityUsd: p.data.liquidityUsd,
                volumeUsd24h: p.data.volumeUsd24h,
              }))}
              selectedPool={{
                poolAddress: pool?.poolAddress ?? "",
                dexId: pool?.dexId ?? "unknown",
                liquidityUsd: pool?.liquidityUsd ?? 0,
                poolName: pool?.poolName ?? "-",
                volumeUsd24h: pool?.volumeUsd24h ?? 0,
              }}
              onPoolChange={(newPoolAddress) =>
                navigate(`/tokens/${address}/${newPoolAddress}`)
              }
            />

            <MarketStats
              data={market}
              pool={pool}
              topHolders={holders}
              holdersInfo={holdersInfo}
              marketsCount={topPools.length}
            />

            <TopHolders holders={holders} holdersInfo={holdersInfo} />
          </div>
        </div>

        <div className={styles.rightColumn}>
          <TokenChart pool={pool} />

          <RecentTransactions
            trades={trades.map((trade) => {
              const kind = trade.buyTokenAddress == address ? "buy" : "sell";

              const amount =
                kind == "buy" ? trade.buyTokenAmount : trade.sellTokenAmount;

              const priceUsd =
                kind == "buy"
                  ? trade.buyTokenPriceUsd
                  : trade.sellTokenPriceUsd;

              // Price in quote token (e.g. SOL per base token)
              const priceQuote =
                kind == "buy"
                  ? trade.sellTokenAmount / trade.buyTokenAmount
                  : trade.buyTokenAmount / trade.sellTokenAmount;

              return {
                kind,
                amount,
                fromAddress: trade.signerAddress,
                id: trade.id,
                timestamp: trade.blockTimestamp,
                txHash: trade.transactionHash,
                volumeUsd: trade.volumeInUsd,
                priceUsd,
                priceQuote,
              };
            })}
            baseMeta={{
              address,
              symbol: meta.symbol,
              imageUrl: meta.imageUrl,
            }}
            tokenAddress={""}
            tokenSymbol={""}
            quoteMeta={{
              address: "",
              symbol: "",
              imageUrl: null,
            }}
          />
        </div>
      </div>
    </PageWrapper>
  );
}
