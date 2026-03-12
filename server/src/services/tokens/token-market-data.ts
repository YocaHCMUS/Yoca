import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenMarketData, type TokenMarketDataInsert } from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type { CG_CoinMarkets } from "../_types/token_raw_responses.js";
import { getCoinGeckoIdList } from "@sv/services/tokens/token-list.js";

const DEFAULT_MARKET_DATA_DECIMALS = 9;

// Prevent duplicated API+DB work when concurrent requests refresh the same stale token set.
const inFlightRefreshes = new Map<
  string,
  Promise<Awaited<ReturnType<typeof fetchTokenMarketData>>>
>();

function refreshKey(tokenAddresses: string[]) {
  return [...new Set(tokenAddresses)].sort().join(",");
}

function asRequiredNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function asOptionalNumber(value: unknown): number | null {
  if (value == null) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function asOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getMarketDataFromRaw(
  address: string,
  raw: CG_CoinMarkets[number],
): TokenMarketDataInsert {
  return {
    address,
    decimals: DEFAULT_MARKET_DATA_DECIMALS,
    fullyDilutedValuation: asRequiredNumber(raw.fully_diluted_valuation),
    marketCap: asRequiredNumber(raw.market_cap),
    priceUsd: asRequiredNumber(raw.current_price),
    totalSupply: asOptionalNumber(raw.total_supply),
    updatedAt: new Date(),
    marketCapRank: asOptionalNumber(raw.market_cap_rank),
    high24h: asOptionalNumber(raw.high_24h),
    low24h: asOptionalNumber(raw.low_24h),
    priceChangePercentage1h: asOptionalNumber(raw.price_change_percentage_1h_in_currency),
    priceChange24h: asOptionalNumber(raw.price_change_24h),
    priceChangePercentage24h: asOptionalNumber(raw.price_change_percentage_24h_in_currency),
    priceChangePercentage7d: asOptionalNumber(raw.price_change_percentage_7d_in_currency),
    priceChangePercentage14d: asOptionalNumber(raw.price_change_percentage_14d_in_currency),
    priceChangePercentage30d: asOptionalNumber(raw.price_change_percentage_30d_in_currency),
    priceChangePercentage200d: asOptionalNumber(raw.price_change_percentage_200d_in_currency),
    priceChangePercentage1y: asOptionalNumber(raw.price_change_percentage_1y_in_currency),
    marketCapChange24h: asOptionalNumber(raw.market_cap_change_24h),
    marketCapChangePercentage24h: asOptionalNumber(raw.market_cap_change_percentage_24h),
    circulatingSupply: asOptionalNumber(raw.circulating_supply),
    maxSupply: asOptionalNumber(raw.max_supply),
    ath: asOptionalNumber(raw.ath),
    athChangePercentage: asOptionalNumber(raw.ath_change_percentage),
    athDate: asOptionalDate(raw.ath_date),
    atl: asOptionalNumber(raw.atl),
    atlChangePercentage: asOptionalNumber(raw.atl_change_percentage),
    atlDate: asOptionalDate(raw.atl_date),
    volume24h: asRequiredNumber(raw.total_volume),
  };
}

async function fetchCgMarketData(cgIdToAddress: Record<string, string>) {
  const cgIds = Object.keys(cgIdToAddress);
  if (cgIds.length == 0) {
    return {};
  }

  const res = (await cg.client.coins.markets.get({
    ids: cgIds.join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
    price_change_percentage: "1h,24h,7d,14d,30d,200d,1y",
  })) as CG_CoinMarkets;

  return Object.fromEntries(
    res.map((raw): [string, TokenMarketDataInsert] => [
      cgIdToAddress[raw.id!],
      getMarketDataFromRaw(cgIdToAddress[raw.id!], raw),
    ]),
  );
}

async function fetchTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }
  const addressToCgId = await getCoinGeckoIdList(tokenAddresses);

  const idToAddress = Object.fromEntries(
    Object.entries(addressToCgId).map(([address, id]) => [id, address]),
  );
  const addressToMarketData = await fetchCgMarketData(idToAddress);

  if (!addressToMarketData) {
    return null;
  }

  const marketDataList = Object.values(addressToMarketData);

  // Return empty array if no tokens found on CoinGecko
  if (marketDataList.length === 0) {
    return [];
  }

  return await db
    .insert(tokenMarketData)
    .values(marketDataList)
    .onConflictDoUpdate({
      target: [tokenMarketData.address],
      set: excludedAuto(tokenMarketData, tokenMarketData.address),
    })
    .returning();
}

async function fetchTokenMarketDataShared(tokenAddresses: string[]) {
  const key = refreshKey(tokenAddresses);
  const inFlight = inFlightRefreshes.get(key);
  if (inFlight) {
    return inFlight;
  }

  const task = fetchTokenMarketData(tokenAddresses).finally(() => {
    inFlightRefreshes.delete(key);
  });
  inFlightRefreshes.set(key, task);
  return task;
}

export async function getTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return {};
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

  if (staleAddresses.length == 0) {
    return addressToMarketData;
  }

  const refreshed = await fetchTokenMarketDataShared(staleAddresses);

  if (!refreshed || refreshed.length === 0) {
    return addressToMarketData;
  }

  for (const data of refreshed) {
    addressToMarketData[data.address] = data;
  }

  return addressToMarketData;
}
