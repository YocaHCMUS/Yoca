import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenMarketData, type TokenMarketDataInsert } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
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
        (rawMarketData): TokenMarketDataInsert => ({
          address: addressLookup[rawMarketData.id],
          priceUsd: rawMarketData.current_price,
          marketCap: rawMarketData.market_cap,
          fullyDilutedValuation: rawMarketData.fully_diluted_valuation,
          volume24h: rawMarketData.total_volume,
          high24h: rawMarketData.high_24h,
          low24h: rawMarketData.low_24h,
          priceChange24h: rawMarketData.price_change_24h,
          priceChangePercentage1h:
            rawMarketData.price_change_percentage_1h_in_currency,
          priceChangePercentage24h:
            rawMarketData.price_change_percentage_24h_in_currency,
          priceChangePercentage14d:
            rawMarketData.price_change_percentage_14d_in_currency,
          priceChangePercentage30d:
            rawMarketData.price_change_percentage_30d_in_currency,
          priceChangePercentage200d:
            rawMarketData.price_change_percentage_200d_in_currency,
          priceChangePercentage1y:
            rawMarketData.price_change_percentage_1y_in_currency,
          marketCapChange24h: rawMarketData.market_cap_change_24h,
          marketCapChangePercentage24h:
            rawMarketData.market_cap_change_percentage_24h,
          circulatingSupply: rawMarketData.circulating_supply,
          totalSupply: rawMarketData.total_supply,
          maxSupply: rawMarketData.max_supply,
          ath: rawMarketData.ath,
          athDate: new Date(rawMarketData.ath_date),
          athChangePercentage: rawMarketData.ath_change_percentage,
          atl: rawMarketData.atl,
          atlDate: new Date(rawMarketData.ath_date),
          atlChangePercentage: rawMarketData.atl_change_percentage,
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
        set: {
          // Had to type all the fields here since unfortunately that is how Postgres works
          priceUsd: excluded(tokenMarketData.priceUsd),
          marketCap: excluded(tokenMarketData.marketCap),
          fullyDilutedValuation: excluded(
            tokenMarketData.fullyDilutedValuation,
          ),
          volume24h: excluded(tokenMarketData.volume24h),
          high24h: excluded(tokenMarketData.high24h),
          low24h: excluded(tokenMarketData.low24h),
          priceChange24h: excluded(tokenMarketData.priceChange24h),
          priceChangePercentage1h: excluded(
            tokenMarketData.priceChangePercentage1h,
          ),
          priceChangePercentage24h: excluded(
            tokenMarketData.priceChangePercentage24h,
          ),
          priceChangePercentage14d: excluded(
            tokenMarketData.priceChangePercentage14d,
          ),
          priceChangePercentage30d: excluded(
            tokenMarketData.priceChangePercentage30d,
          ),
          priceChangePercentage200d: excluded(
            tokenMarketData.priceChangePercentage200d,
          ),
          priceChangePercentage1y: excluded(
            tokenMarketData.priceChangePercentage1y,
          ),
          marketCapChange24h: excluded(tokenMarketData.marketCapChange24h),
          marketCapChangePercentage24h: excluded(
            tokenMarketData.marketCapChangePercentage24h,
          ),
          circulatingSupply: excluded(tokenMarketData.circulatingSupply),
          totalSupply: excluded(tokenMarketData.totalSupply),
          maxSupply: excluded(tokenMarketData.maxSupply),
          ath: excluded(tokenMarketData.ath),
          athChangePercentage: excluded(tokenMarketData.athChangePercentage),
          atl: excluded(tokenMarketData.atl),
          atlChangePercentage: excluded(tokenMarketData.atlChangePercentage),
        },
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
