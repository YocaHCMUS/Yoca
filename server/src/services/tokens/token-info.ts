import {
  TOKEN_DETAILS_TTL_MS,
  TOP_TOKEN_HOLDER_STATS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenDetails,
  tokenHolderStats,
  tokenMarketData,
  tokenMeta,
  type TokenDetailedInfoInsert,
  type TokenHolderStatsInsert,
  type TokenMarketDataInsert,
  type TokenMetaInsert,
} from "@sv/db/schema.js";
import { excludedAutoFromInsert } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte, inArray } from "drizzle-orm";
import { getCoinGeckoIdsByAddresses } from "./token-list.js";

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
  if (tokenAddresses.length == 0) {
    return Promise.resolve([]);
  }
  return Promise.all(
    tokenAddresses.map((address) => fetchHolderStatsItem(address)),
  );
}

// https://docs.coingecko.com/v3.0.1/reference/coins-id
async function fetchTokenDetails(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return {
      meta: [],
      details: [],
      market: [],
    };
  }

  const addressToCgIds = await getCoinGeckoIdsByAddresses(tokenAddresses);

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

  const details = rawInfoList.map(
    (
      raw,
    ): {
      meta: TokenMetaInsert;
      detailedInfo: TokenDetailedInfoInsert;
      market: TokenMarketDataInsert;
    } => ({
      meta: {
        address: raw.platforms!.solana!,
        name: raw.name!,
        symbol: raw.symbol!,
        imageUrl: raw.image?.small,
      },
      detailedInfo: {
        coingeckoId: raw.id,
        decimals: raw.detail_platforms!.solana!.decimal_place!,
        address: raw.platforms!.solana!,
        description: raw.description!.en!,
        categories: raw.categories_details?.map((detail) => detail.id!),
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

  const metaValues = details.map((detail) => detail.meta);
  const detailedInfoValues = details.map((detail) => detail.detailedInfo);
  const marketDataValues = details.map((detail) => detail.market);

  return {
    meta: await db
      .insert(tokenMeta)
      .values(metaValues)
      .onConflictDoUpdate({
        target: [tokenMeta.address],
        set: excludedAutoFromInsert(tokenMeta, tokenMeta.address, metaValues),
      })
      .returning(),
    details: await db
      .insert(tokenDetails)
      .values(detailedInfoValues)
      .onConflictDoUpdate({
        target: [tokenDetails.address],
        set: excludedAutoFromInsert(
          tokenDetails,
          tokenDetails.address,
          detailedInfoValues,
        ),
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

async function fetchTokenMeta(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return [];
  }
  // We cheat and use makert data here as it allow get multiple tokens info in one request
  // Potential extra 1 API here, but better than fetch each addresses.
  const addressToCgId = await getCoinGeckoIdsByAddresses(tokenAddresses);
  const cgIds = Object.values(addressToCgId);

  const res = await cg.client.coins.markets.get({
    ids: cgIds.join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
  });

  const cgIdToAddress = Object.fromEntries(
    Object.entries(addressToCgId).map(([address, id]) => [id, address]),
  );

  const metaValues = res
    .filter((raw) => cgIdToAddress[raw.id!])
    .map(
      (raw): TokenMetaInsert => ({
        address: cgIdToAddress[raw.id!],
        name: raw.name!,
        symbol: raw.symbol!,
        imageUrl: raw.image,
      }),
    );
  console.log(metaValues);

  return db
    .insert(tokenMeta)
    .values(metaValues)
    .onConflictDoUpdate({
      target: [tokenMeta.address],
      set: excludedAutoFromInsert(tokenMeta, tokenMeta.address, metaValues),
    })
    .returning();
}

export async function getTokenMeta(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return [];
  }

  const thresholdDate = new Date(Date.now() - TOKEN_DETAILS_TTL_MS);

  const res = await db
    .select()
    .from(tokenMeta)
    .where(
      and(
        inArray(tokenMeta.address, tokenAddresses),
        gte(tokenMeta.updatedAt, thresholdDate),
      ),
    )
    .limit(tokenAddresses.length);

  const addressToMeta = Object.fromEntries(
    res.map((meta) => [meta.address, meta]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !addressToMeta[address],
  );

  const refreshed = await fetchTokenMeta(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}

export async function getTokenDetails(tokenAddresses: string[]) {
  const thresholdDate = new Date(Date.now() - TOKEN_DETAILS_TTL_MS);

  const res = await db
    .select({
      address: tokenMeta.address,
      meta: tokenMeta,
      details: tokenDetails,
    })
    .from(tokenMeta)
    .innerJoin(tokenDetails, eq(tokenMeta.address, tokenDetails.address))
    .where(
      and(
        inArray(tokenMeta.address, tokenAddresses),
        gte(tokenMeta.updatedAt, thresholdDate),
        gte(tokenDetails.updatedAt, thresholdDate),
      ),
    );
  if (res.length == tokenAddresses.length) {
    return res;
  }

  const addressToRes = Object.fromEntries(res.map((row) => [row.address, row]));

  const staleAddresses = tokenAddresses.filter(
    (address) => !addressToRes[address],
  );
  const { meta: refreshedMeta, details: refreshedDetails } =
    await fetchTokenDetails(staleAddresses);
  const addressToRefreshedDetails = Object.fromEntries(
    refreshedDetails.map((detail) => [detail.address, detail]),
  );

  const refreshed = refreshedMeta
    .filter((meta) => addressToRefreshedDetails[meta.address])
    .map((meta) => ({
      address: meta.address,
      meta,
      details: addressToRefreshedDetails[meta.address],
    }));
  const full = [...res, ...refreshed];

  return full;
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

  if (staleAddresses.length == 0) {
    return res;
  }

  const refreshed = await fetchHolderStats(staleAddresses);

  const persisted = await db
    .insert(tokenHolderStats)
    .values(refreshed)
    .onConflictDoUpdate({
      target: [tokenHolderStats.address],
      set: excludedAutoFromInsert(
        tokenHolderStats,
        tokenHolderStats.address,
        refreshed,
      ),
    })
    .returning();

  return [...res, ...persisted];
}
