import {
  TOKEN_META_TTL_MS,
  TOP_TOKEN_HOLDER_STATS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenHolderStats,
  tokenMarketData,
  tokenMeta,
  type TokenHolderStatsInsert,
  type TokenMarketDataInsert,
  type TokenMetaInsert,
} from "@sv/db/schema.js";
import { excludedAutoFromInsert } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import { getCoinGeckoIdList } from "./token-list.js";

async function fetchHolderStatsItem(
  tokenAddress: string,
): Promise<TokenHolderStatsInsert> {
  const res = await cg.client.onchain.networks.tokens.info.get(tokenAddress, {
    network: "solana",
  });

  return {
    address: res.data!.attributes!.address!,
    holdersCount: res.data?.attributes?.holders?.count || 0,
    top10Percent:
      res.data?.attributes?.holders?.distribution_percentage?.top_10 || 0,
  };
}

function fetchHolderStats(tokenAddresses: string[]) {
  return Promise.all(
    tokenAddresses.map((address) => fetchHolderStatsItem(address)),
  );
}

// https://docs.coingecko.com/v3.0.1/reference/coins-id
async function fetchTokenMeta(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return {
      meta: [],
      market: [],
    };
  }

  const addressToCgIds = await getCoinGeckoIdList(tokenAddresses);

  const rawInfoList = await Promise.all(
    tokenAddresses
      .filter((address) => addressToCgIds[address])
      .map(async (address) => {
        const rawMeta = await cg.client.coins.getID(addressToCgIds[address], {
          localization: false,
          tickers: false,
          market_data: true,
          community_data: true,
          developer_data: true,
          include_categories_details: true,
        });
        return rawMeta;
      }),
  );

  const infoList = rawInfoList.map(
    (raw): { meta: TokenMetaInsert; market: TokenMarketDataInsert } => ({
      meta: {
        address: raw.platforms!.solana!,
        name: raw.name!,
        symbol: raw.symbol!,
        categories: raw.categories_details?.map((detail) => detail.id!),
        coingeckoId: raw.id,
        description: raw.description!.en!,
        imageUrl: raw.image?.small,
        linkBlockchainSites: raw.links?.blockchain_site,
        linkDiscord: raw.links?.chat_url?.find((url) =>
          url.startsWith("https://discord.com/invite/"),
        ),
        linkHomepage: raw.links?.homepage?.at(0),
        telegramChannel: raw.links?.telegram_channel_identifier,
        twitterScreenName: raw.links?.twitter_screen_name,
      },
      market: {
        address: raw.platforms!.solana!,
        decimals: raw.detail_platforms!.solana!.decimal_place!,
        fullyDilutedValuation: raw.market_data?.fully_diluted_valuation?.usd!,
        marketCap: raw.market_data?.market_cap?.usd!,
        marketCapRank: raw.market_data?.market_cap_rank!,
        priceUsd: raw.market_data?.current_price?.usd!,
        volume24h: raw.market_data?.total_volume?.usd!,
        ath: raw.market_data?.ath?.usd!,
        athChangePercentage: raw.market_data?.ath_change_percentage?.usd!,
        athDate: new Date(raw.market_data?.ath_date?.usd!),
        atl: raw.market_data?.atl?.usd!,
        atlChangePercentage: raw.market_data?.atl_change_percentage?.usd!,
        atlDate: new Date(raw.market_data?.atl_date?.usd!),
        circulatingSupply: raw.market_data?.circulating_supply,
        high24h: raw.market_data?.high_24h?.usd!,
        low24h: raw.market_data?.low_24h?.usd!,
        priceChangePercentage1h:
          raw.market_data?.price_change_percentage_1h_in_currency?.usd,
        priceChange24h: raw.market_data?.price_change_24h,
        priceChangePercentage24h: raw.market_data?.price_change_percentage_24h,
        priceChangePercentage7d: raw.market_data?.price_change_percentage_7d,
        priceChangePercentage14d: raw.market_data?.price_change_percentage_14d,
        priceChangePercentage30d: raw.market_data?.price_change_percentage_30d,
        priceChangePercentage200d:
          raw.market_data?.price_change_percentage_200d,
        priceChangePercentage1y: raw.market_data?.price_change_percentage_1y,
        marketCapChange24h: raw.market_data?.market_cap_change_24h,
        marketCapChangePercentage24h:
          raw.market_data?.market_cap_change_percentage_24h,
        maxSupply: raw.market_data?.max_supply,
        totalSupply: raw.market_data?.total_supply,
      },
    }),
  );

  const metaValues = infoList.map((info) => info.meta);
  const marketDataValues = infoList.map((info) => info.market);

  return {
    meta: await db
      .insert(tokenMeta)
      .values(metaValues)
      .onConflictDoUpdate({
        target: [tokenMeta.address],
        set: excludedAutoFromInsert(tokenMeta, tokenMeta.address, metaValues),
      })
      .returning(),
    market: await db
      .insert(tokenMarketData)
      .values(marketDataValues)
      .onConflictDoUpdate({
        target: [tokenMarketData.address],
        set: excludedAutoFromInsert(
          tokenMarketData,
          tokenMarketData.address,
          marketDataValues,
        ),
      })
      .returning(),
  };
}

export async function getTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return [];
  }

  const thresholdDate = new Date(Date.now() - TOKEN_META_TTL_MS);

  const res = await db
    .select()
    .from(tokenMeta)
    .where(
      and(
        gte(tokenMeta.updatedAt, thresholdDate),
        inArray(tokenMeta.address, tokenAddresses),
      ),
    )
    .limit(tokenAddresses.length);

  const addressToMeta = Object.fromEntries(
    res.map((meta) => [meta.address, meta]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !addressToMeta[address],
  );

  const refreshed = (await fetchTokenMeta(staleAddresses)).meta;

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}

export async function getTokenHolderStats(tokenAddresses: string[]) {
  const thresholdDate = new Date(Date.now() - TOP_TOKEN_HOLDER_STATS_TTL_MS);

  const res = await db
    .select()
    .from(tokenHolderStats)
    .where(
      and(
        gte(tokenHolderStats.updatedAt, thresholdDate),
        inArray(tokenHolderStats.address, tokenAddresses),
      ),
    );

  const addressToHolderStat = Object.fromEntries(
    res.map((holderStat) => [holderStat.address, holderStat]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !addressToHolderStat[address],
  );

  const refreshed = await fetchHolderStats(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}
