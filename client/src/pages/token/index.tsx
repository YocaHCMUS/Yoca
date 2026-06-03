import client from "@/api/main";
import {
  MarketStats,
  NewsTab,
  PoolSelector,
  RecentTransactions,
  TokenChart,
  TokenHeader,
  VolatilitySignals,
  TopHolders,
} from "@/components/token";
import { PageWrapper } from "@/components/wrapper/PageWrapper";
import { useGet } from "@/hooks/useGet";
import { InlineLoading } from "@carbon/react";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import styles from "./index.module.scss";

function useTokenPageData(
  address: string | undefined,
  poolAddress: string | undefined,
) {
  const resolvedAddress = address ?? "";
  const resolvedPoolAddress = poolAddress ?? "";

  const baseMeta = useGet(
    client.api.tokens.details[":addresses"],
    200,
    {
      param: { addresses: resolvedAddress },
    },
    {
      select: (dataArr) =>
        dataArr.map((data) => ({
          ...data.meta,
          ...data.details,
        })),
      enabled: Boolean(address),
    },
  );

  const topPools = useGet(
    client.api.tokens[":address"].pools,
    200,
    {
      param: { address: resolvedAddress },
    },
    {
      enabled: Boolean(address),
    },
  );

  const holders = useGet(
    client.api.tokens.holders[":address"],
    200,
    {
      param: { address: resolvedAddress },
    },
    {
      enabled: Boolean(address),
    },
  );

  const holdersStats = useGet(
    client.api.tokens.holders.stats[":addresses"],
    200,
    {
      param: { addresses: resolvedAddress },
    },
    {
      enabled: Boolean(address),
    },
  );

  const marketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    {
      param: { addresses: resolvedAddress },
    },
    {
      enabled: Boolean(address),
    },
  );

  const trades = useGet(
    client.api.tokens.pools.trades[":address"],
    200,
    {
      param: { address: resolvedPoolAddress },
    },
    {
      enabled: Boolean(poolAddress),
    },
  );

  const poolData = useGet(
    client.api.tokens.pools[":addresses"],
    200,
    {
      param: { addresses: resolvedPoolAddress },
      query: { refresh: "true" },
    },
    {
      enabled: Boolean(poolAddress),
    },
  );

  const isLoading = baseMeta.isLoading || topPools.isLoading || marketData.isLoading;
  const pairLoading = trades.isLoading || poolData.isLoading;

  // Only block on critical data errors, not holders (which depends on Moralis API)
  const error = baseMeta.error || topPools.error || marketData.error;
  const pairError = trades.error || poolData.error;

  if (isLoading || error) {
    return {
      isLoading,
      error,
      pairLoading,
      pairError,
      data: null as null,
    };
  }

  const [metaFromApi] = baseMeta.data ?? [];
  const [holdersInfo] = holdersStats.data ?? [null];
  const pool = poolData.data?.[0] ?? null;

  if (!pool || !baseMeta.data) {
    return {
      isLoading: false,
      error: new Error(!pool ? "Pool data is unavailable" : "Token metadata is unavailable"),
      data: null as null,
    };
  }

  const fallbackSymbol = pool?.poolName?.split(" / ")[0] || "UNKNOWN";
  const fallbackName = fallbackSymbol !== "UNKNOWN" ? fallbackSymbol : "Unknown Token";

  const meta = {
    ...metaFromApi,
    name:
      metaFromApi?.name && metaFromApi.name !== "Unknown Token"
        ? metaFromApi.name
        : fallbackName,
    symbol:
      metaFromApi?.symbol && metaFromApi.symbol !== "UNKNOWN"
        ? metaFromApi.symbol
        : fallbackSymbol,
    address: metaFromApi?.address ?? resolvedAddress,
    imageUrl: metaFromApi?.imageUrl ?? pool?.baseImageUrl ?? undefined,
  };

  const normalizedTopPools = (topPools.data ?? []).filter((p) => !!p?.data);

  return {
    isLoading: false,
    error: null,
    pairLoading,
    pairError,
    data: {
      meta,
      topPools: normalizedTopPools,
      holders: holders.data ?? [],
      holdersInfo,
      market: marketData.data?.[resolvedAddress] ?? null,
      trades: trades.data ?? [],
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

  if (!address || !poolAddress) {
    return <>Forgot to add address!</>;
  }

  if (poolAddress && !result.error && (result.pairLoading || !pairData)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
        <div style={{ width: 'fit-content' }}>
          <InlineLoading status="active" description="Loading token data..." />
        </div>
      </div>
    );
  }

  if (result.isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
        <div style={{ width: 'fit-content' }}>
          <InlineLoading status="active" description="Loading token data..." />
        </div>
      </div>
    );
  }

  if (result.error || !result.data || !result.data.meta) {
    return (
      <PageWrapper>
        <div style={{ padding: "2rem", textAlign: "center" }}>
          <h2>Data Unavailable</h2>
          <p>
            {result.error instanceof Error
              ? result.error.message
              : "Could not load token details. Please try again later."}
          </p>
        </div>
      </PageWrapper>
    );
  }

  const { meta, topPools, holders, holdersInfo, market, trades } =
    result.data;
  const pool = pairData;

  if (!pool) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width: '100%' }}>
        <div style={{ width: 'fit-content' }}>
          <InlineLoading status="active" description="Loading token data..." />
        </div>
      </div>
    );
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

            <TopHolders
              holders={holders}
              holdersInfo={holdersInfo}
              currentTokenPriceUsd={
                pool?.baseTokenPriceUsd != null
                  ? Number(pool.baseTokenPriceUsd)
                  : market?.priceUsd != null
                    ? Number(market.priceUsd)
                    : 0
              }
              tokenSymbol={meta.symbol}
              totalSupply={market?.totalSupply ?? null}
            />

            <NewsTab address={address} symbol={meta.symbol} name={meta.name} />
          </div>
        </div>

        <div className={styles.rightColumn}>
          <TokenChart pool={pool} />

          <VolatilitySignals
            address={address}
            symbol={meta.symbol}
            name={meta.name}
          />

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
              imageUrl: meta.imageUrl ?? null,
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
