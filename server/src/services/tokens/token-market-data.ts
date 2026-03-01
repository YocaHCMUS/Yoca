import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  coinGeckoTokenList,
  tokenMarketData,
  type TokenMarketDataInsert,
} from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type {
  CG_CoinMarkets,
  CG_TokenDataByAddresses,
} from "../_types/token_raw_responses.js";

type OnChainCgResult = Required<
  Pick<
    TokenMarketDataInsert,
    | "address"
    | "decimals"
    | "priceUsd"
    | "marketCap"
    | "fullyDilutedValuation"
    | "volume24h"
    | "totalSupply"
    | "totalLiquidity"
    | "updatedAt"
  >
>;

type CgResult = Required<
  Pick<
    TokenMarketDataInsert,
    Exclude<keyof TokenMarketDataInsert, keyof OnChainCgResult>
  >
> &
  // CG total_volume overrides onchain volume24h when available
  Partial<Pick<TokenMarketDataInsert, "volume24h">>;

// https://docs.coingecko.com/reference/tokens-data-contract-addresses
async function fetchOnchainMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const cgEndpoint = cg.getOnchainEndpoint(
    `/networks/solana/tokens/multi/${tokenAddresses.join(",")}`,
  );

  cgEndpoint.search = new URLSearchParams({
    include: "top_pools",
    include_composition: "true",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return null;
  }

  const res: CG_TokenDataByAddresses = await resp.json();

  return Object.fromEntries(
    res.data.map((raw): [string, OnChainCgResult] => [
      raw.attributes.address,
      {
        address: raw.attributes.address,
        decimals: raw.attributes.decimals,
        priceUsd: Number(raw.attributes.price_usd),
        marketCap: Number(raw.attributes.market_cap_usd),
        fullyDilutedValuation: Number(raw.attributes.fdv_usd),
        volume24h: Number(raw.attributes.volume_usd.h24),
        totalSupply: Number(raw.attributes.total_supply) / Math.pow(10, raw.attributes.decimals),
        totalLiquidity: Number(raw.attributes.total_reserve_in_usd),
        updatedAt: new Date(),
      },
    ]),
  );
}

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
async function fetchCgMarketData(cgIdToAddress: Record<string, string>) {
  const cgIds = Object.keys(cgIdToAddress);
  if (cgIds.length == 0) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint(`/coins/markets`);
  cgEndpoint.search = new URLSearchParams({
    ids: cgIds.join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) {
    return null;
  }

  const res: CG_CoinMarkets = await resp.json();

  return Object.fromEntries(
    res.map((raw): [string, CgResult] => [
      cgIdToAddress[raw.id],
      {
        priceBtc: null,
        priceChangeBtc24h: null,
        marketCapRank: raw.market_cap_rank,
        high24h: raw.high_24h,
        low24h: raw.low_24h,
        priceChangePercentage1h: raw.price_change_percentage_1h_in_currency,
        priceChange24h: raw.price_change_24h,
        priceChangePercentage24h: raw.price_change_percentage_24h_in_currency,
        priceChangePercentage7d: raw.price_change_percentage_7d_in_currency,
        priceChangePercentage14d: raw.price_change_percentage_14d_in_currency,
        priceChangePercentage30d: raw.price_change_percentage_30d_in_currency,
        priceChangePercentage200d: raw.price_change_percentage_200d_in_currency,
        priceChangePercentage1y: raw.price_change_percentage_1y_in_currency,
        marketCapChange24h: raw.market_cap_change_24h,
        marketCapChangePercentage24h: raw.market_cap_change_percentage_24h,
        circulatingSupply: raw.circulating_supply,
        maxSupply: raw.max_supply,
        ath: raw.ath,
        athChangePercentage: raw.ath_change_percentage,
        athDate: new Date(raw.ath_date),
        atl: raw.atl,
        atlChangePercentage: raw.atl_change_percentage,
        atlDate: new Date(raw.atl_date),
        volume24h: raw.total_volume,
      },
    ]),
  );
}

async function fetchTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  // Onchain data takes priority as it's more accurate to operating DEXs
  const onchainData = await fetchOnchainMarketData(tokenAddresses);

  if (!onchainData) {
    return null;
  }

  const res = await db
    .select()
    .from(coinGeckoTokenList)
    .where(inArray(coinGeckoTokenList.tokenAddress, tokenAddresses));

  const idToAddress = Object.fromEntries(
    res
      .filter((entry) => entry.coinGeckoId)
      .map((entry) => [entry.coinGeckoId, entry.tokenAddress]),
  );

  const cgData = await fetchCgMarketData(idToAddress);

  if (!cgData) {
    return null;
  }

  const addressToMarketData = Object.fromEntries(
    tokenAddresses
      .filter((address) => onchainData[address] && cgData[address])
      .map((address) => [
        address,
        {
          ...onchainData[address],
          ...cgData[address],
        },
      ]),
  );

  const marketDataList = Object.values(addressToMarketData);

  await db
    .insert(tokenMarketData)
    .values(marketDataList)
    .onConflictDoUpdate({
      target: [tokenMarketData.address],
      set: excludedAuto(tokenMarketData, tokenMarketData.address),
    })
    .returning();

  return addressToMarketData;
}
export async function getTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const thresholdDate = new Date(Date.now() - TOKEN_MARKET_DATA_TTL_MS);
  const res = await db
    .select()
    .from(tokenMarketData)
    .where(
      and(
        gte(tokenMarketData.updatedAt, thresholdDate),
        inArray(tokenMarketData.address, tokenAddresses),
      ),
    )
    .limit(tokenAddresses.length);

  const addressToMarketData = Object.fromEntries(
    res.map((item) => [item.address, item]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !addressToMarketData[address],
  );

  const refreshed = await fetchTokenMarketData(staleAddresses);

  if (!refreshed) {
    return addressToMarketData;
  }

  for (const [address, data] of Object.entries(refreshed)) {
    addressToMarketData[address] = data;
  }

  return addressToMarketData;
}
