import {
  TOKEN_META_TTL_MS,
  TOP_TOKEN_HOLDER_STATS_TTL_MS,
} from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenHolderStats,
  tokenMeta,
  type TokenHolderStatsInsert,
  type TokenMetaInsert,
} from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type { CG_CoinDetail, CG_TokenInfo } from "../_types/token_raw_responses.js";

// Fetch enriched info from CoinGecko v3 /coins/{id}
async function fetchCoinDetail(coingeckoId: string): Promise<CG_CoinDetail | null> {
  if (!coingeckoId) return null;

  const cgEndpoint = cg.getEndpoint(`/coins/${coingeckoId}`);
  cgEndpoint.search = new URLSearchParams({
    localization: "false",
    tickers: "false",
    market_data: "false",
    community_data: "false",
    developer_data: "false",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) return null;

  return resp.json();
}

// https://docs.coingecko.com/v3.0.1/reference/token-info-contract-address
async function fetchTokenInfo(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return {
      meta: [],
      holders: [],
    };
  }

  const rawInfoList = await Promise.all(
    tokenAddresses.map(async (address) => {
      const cgEndpoint = cg.getOnchainEndpoint(
        `/networks/solana/tokens/${address}/info/`,
      );

      const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
      });

      const resp = await fetch(req);
      if (resp.ok) {
        const rawMeta: CG_TokenInfo = await resp.json();
        return rawMeta;
      } else {
        return null;
      }
    }),
  );

  // Build base meta + holders from onchain info
  const infoList = rawInfoList
    .filter((rawMeta) => rawMeta != null)
    .map((raw): { meta: TokenMetaInsert; holders: TokenHolderStatsInsert } => ({
      meta: {
        address: raw.data.attributes.address,
        symbol: raw.data.attributes.symbol,
        name: raw.data.attributes.name,
        description: raw.data.attributes.description || null,
        imageUrl: raw.data.attributes.image_url,
        linkHomepage: raw.data.attributes.websites?.at(0) || null,
        linkDiscord: raw.data.attributes.discord_url || null,
        twitterScreenName: raw.data.attributes.twitter_handle || null,
        coingeckoId: raw.data.attributes.coingecko_coin_id,
      },
      holders: {
        address: raw.data.attributes.address,
        holdersCount: raw.data.attributes.holders?.count || 0,
        top10Percent:
          raw.data.attributes.holders?.distribution_percentage?.top_10 || 0,
      },
    }));

  if (infoList.length == 0) {
    return {
      meta: [],
      holders: [],
    };
  }

  // Enrich with v3 /coins/{id} data for tokens that have a coingeckoId
  await Promise.all(
    infoList.map(async (info) => {
      if (!info.meta.coingeckoId) return;

      const detail = await fetchCoinDetail(info.meta.coingeckoId);
      if (!detail) return;

      const links = detail.links;
      info.meta.telegramChannel = links.telegram_channel_identifier || null;
      info.meta.linkBlockchainSites = JSON.stringify(
        (links.blockchain_site || []).filter((url: string) => url && url.length > 0),
      );
      info.meta.categories = JSON.stringify(
        (detail.categories || []).filter((cat: string) => cat && cat.length > 0),
      );
      info.meta.platforms = JSON.stringify(detail.platforms || {});

      // Override with richer v3 data if available
      if (links.homepage?.[0]) info.meta.linkHomepage = links.homepage[0];
      if (links.twitter_screen_name) info.meta.twitterScreenName = links.twitter_screen_name;
      if (links.chat_url?.[0]) info.meta.linkDiscord = links.chat_url[0];
    }),
  );

  return {
    meta: await db
      .insert(tokenMeta)
      .values(infoList.map((info) => info.meta))
      .onConflictDoUpdate({
        target: [tokenMeta.address],
        set: excludedAuto(tokenMeta, tokenMeta.address),
      })
      .returning(),
    holders: await db
      .insert(tokenHolderStats)
      .values(infoList.map((info) => info.holders))
      .onConflictDoUpdate({
        target: [tokenHolderStats.address],
        set: excludedAuto(tokenHolderStats, tokenHolderStats.address),
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

  const refreshed = (await fetchTokenInfo(staleAddresses)).meta;

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

  const refreshed = (await fetchTokenInfo(staleAddresses)).holders;

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}
