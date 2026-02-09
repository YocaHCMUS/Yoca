import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenMarketData, type TokenMarketDataInsert } from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type { CG_TokenMarketData } from "../_types/token_raw_responses.js";
import { fetchCgTokenList, getCoinGeckoIdList } from "./token-list.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
async function fetchTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const idLookup =
    (await getCoinGeckoIdList(tokenAddresses)) ??
    (await fetchCgTokenList(tokenAddresses));

  if (!idLookup) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint(`/coins/markets`);

  cgEndpoint.search = new URLSearchParams({
    ids: Object.values(idLookup)
      .filter((id) => id != null)
      .join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
    price_change_percentage: "1h,24h,14d,30d,200d,1y",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });
  const resp = await fetch(req);

  if (resp.ok) {
    const res: CG_TokenMarketData[] = await resp.json();

    const addressLookup = Object.fromEntries(
      Object.entries(idLookup)
        .filter(([, id]) => id != null)
        .map(([address, id]) => [id, address]),
    );

    const marketDataList = res
      .filter((raw) => addressLookup[raw.id])
      .map(
        (raw): TokenMarketDataInsert => ({
          address: addressLookup[raw.id],
          decimals: raw.de,
          priceUsd: raw.current_price,
          marketCap: raw.market_cap,
          fullyDilutedValuation: raw.fully_diluted_valuation,
          volume24h: raw.total_volume,
          high24h: raw.high_24h,
          low24h: raw.low_24h,
          priceChange24h: raw.price_change_24h,
          priceChangePercentage1h:
            raw.price_change_percentage_1h_in_currency,
          priceChangePercentage24h:
            raw.price_change_percentage_24h_in_currency,
          priceChangePercentage14d:
            raw.price_change_percentage_14d_in_currency,
          priceChangePercentage30d:
            raw.price_change_percentage_30d_in_currency,
          priceChangePercentage200d:
            raw.price_change_percentage_200d_in_currency,
          priceChangePercentage1y:
            raw.price_change_percentage_1y_in_currency,
          marketCapChange24h: raw.market_cap_change_24h,
          marketCapChangePercentage24h:
            raw.market_cap_change_percentage_24h,
          circulatingSupply: raw.circulating_supply,
          totalSupply: raw.total_supply,
          maxSupply: raw.max_supply,
          ath: raw.ath,
          athDate: new Date(raw.ath_date),
          athChangePercentage: raw.ath_change_percentage,
          atl: raw.atl,
          atlDate: new Date(raw.ath_date),
          atlChangePercentage: raw.atl_change_percentage,
        }),
      );

    if (marketDataList.length === 0) {
      return null;
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
  return null;
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

  const marketDataLookup = Object.fromEntries(
    res.map((marketData) => [marketData.address, marketData]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !marketDataLookup[address],
  );
  const refreshed = await fetchTokenMarketData(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    return [...res, ...refreshed];
  }
}
