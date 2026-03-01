import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenMarketData, type TokenMarketDataInsert } from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type { CG_CoinMarkets } from "../_types/token_raw_responses.js";
import { getCoinGeckoIdList } from "./token-list.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
async function fetchCgMarketData(cgIdToAddress: Record<string, string>) {
  const cgIds = Object.keys(cgIdToAddress);
  if (cgIds.length == 0) {
    return {};
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
    return {};
  }

  const res: CG_CoinMarkets = await resp.json();

  return Object.fromEntries(
    res.map((raw): [string, TokenMarketDataInsert] => [
      cgIdToAddress[raw.id],
      {
        address: cgIdToAddress[raw.id],
        decimals: 9,
        fullyDilutedValuation: raw.fully_diluted_valuation,
        marketCap: raw.market_cap,
        priceUsd: raw.current_price,
        totalSupply: raw.total_supply,
        updatedAt: new Date(),
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
  const addressToCgId = await getCoinGeckoIdList(tokenAddresses);

  const idToAddress = Object.fromEntries(
    Object.entries(addressToCgId).map(([address, id]) => [id, address]),
  );
  const addressToMarketData = await fetchCgMarketData(idToAddress);

  if (!addressToMarketData) {
    return null;
  }

  const marketDataList = Object.values(addressToMarketData);

  return await db
    .insert(tokenMarketData)
    .values(marketDataList)
    .onConflictDoUpdate({
      target: [tokenMarketData.address],
      set: excludedAuto(tokenMarketData, tokenMarketData.address),
    })
    .returning();
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

  const refreshed = await fetchTokenMarketData(staleAddresses);

  if (!refreshed) {
    return addressToMarketData;
  }

  for (const [address, data] of Object.entries(refreshed)) {
    addressToMarketData[address] = data;
  }

  return addressToMarketData;
}
