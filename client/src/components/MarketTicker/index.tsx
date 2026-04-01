import client from "@/api/main";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useGet } from "@/hooks/useGet";
import { SkeletonPlaceholder, Stack } from "@carbon/react";
import React, { useMemo } from "react";
import { Link } from "react-router";
import { TknImg } from "../TknImg";
import { TrendNum } from "../TrendNum";
import { Txt } from "../Txt";
import styles from "./MarketTicker.module.scss";

export interface MarketTickerItem {
  address: string;
  rank: number;
  symbol: string;
  imageUrl?: string;
  priceUsd: number;
  priceChange24h: number;
}

interface MarketTickerProps {
  className?: string;
  label: string;
  icon: React.ReactNode;
}

function MarketTicker({ label, icon, className }: MarketTickerProps) {
  const { fmt } = useLocalization();

  const trendingTokens = useGet(client.api.tokens.trending, 200);

  const trendingAddresses = useMemo(
    () => trendingTokens.data?.map((t) => t.address).join(","),
    [trendingTokens.data],
  );

  const trendingMeta = useGet(
    client.api.tokens.meta[":addresses"],
    200,
    { param: { addresses: trendingAddresses || "" } },
    { enabled: !!trendingAddresses },
  );

  const trendingMarketData = useGet(
    client.api.tokens.markets[":addresses"],
    200,
    { param: { addresses: trendingAddresses || "" } },
    { enabled: !!trendingAddresses },
  );

  const items = useMemo(() => {
    if (!trendingTokens.data || !trendingMeta.data || !trendingMarketData.data)
      return [];

    const addressToMeta = Object.fromEntries(
      trendingMeta.data.map((m) => [m.address, m]),
    );
    const addressToMarket = trendingMarketData.data;

    return trendingTokens.data.map((token) => {
      const tokenMeta = addressToMeta[token.address];
      const tokenMarket = addressToMarket[token.address];

      return {
        address: token.address,
        rank: token.rank,
        symbol: tokenMeta?.symbol || "",
        imageUrl: tokenMeta?.imageUrl ?? undefined,
        priceUsd: tokenMarket?.priceUsd || 0,
        priceChange24h: tokenMarket?.priceChange24h || 0,
      };
    });
  }, [trendingTokens.data, trendingMeta.data, trendingMarketData.data]);

  // Duplicate items for infinite scroll effect
  const displayItems = [...items, ...items, ...items, ...items];

  return (
    <div
      className={className}
      style={{ display: "flex", width: "100%", height: 48 }}
    >
      <Stack
        gap={1}
        orientation="horizontal"
        style={{
          alignItems: "center",
          width: "9rem",
          justifyContent: "center",
          paddingLeft: 16,
          paddingRight: 16,
        }}
      >
        {icon}
        <strong style={{ textTransform: "uppercase" }}>{label}</strong>
      </Stack>
      <div className={styles.tickerWrapper} style={{ width: "100%" }}>
        {displayItems.length == 0 ? (
          <SkeletonPlaceholder style={{ width: "100%", height: 48 }} />
        ) : (
          <div className={styles.tickerContent}>
            {displayItems.map((item, idx) => (
              <Link
                key={`${item.address}-${idx}`}
                to={`/tokens/${item.address}`}
                className={styles.tickerItem}
              >
                <span>#{item.rank}</span>
                <TknImg src={item.imageUrl} size={24} />
                <Txt ellipsis>{item.symbol.toUpperCase()}</Txt>
                <span>{fmt.num.currency(item.priceUsd)}</span>
                <TrendNum
                  value={item.priceChange24h}
                  formatter={fmt.num.percent}
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MarketTicker;
