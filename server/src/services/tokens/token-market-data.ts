import { TOKEN_MARKET_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  tokenMarketData,
  tokenMeta,
  type TokenMarketDataInsert,
} from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type {
  CG_TokenDataByAddress,
  CG_TokenMarketData,
} from "../_types/token_raw_responses.js";

// https://docs.coingecko.com/reference/tokens-token-address-multi
async function fetchOnchainMarketData(
  tokenAddresses: string[],
): Promise<Map<string, Partial<TokenMarketDataInsert>>> {
  const result = new Map<string, Partial<TokenMarketDataInsert>>();

  if (tokenAddresses.length == 0) {
    return result;
  }

  const cgEndpoint = cg.getOnchainEndpoint(
    `/networks/solana/tokens/multi/${tokenAddresses.join(",")}`,
  );

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return result;
  }

  const json: CG_TokenDataByAddress = await resp.json();

  for (const token of json.data) {
    const attrs = token.attributes;
    console.log(`[OnchainData] Token: ${attrs.address}, MarketCap: ${attrs.market_cap_usd}, FDV: ${attrs.fdv_usd}, Volume: ${attrs.volume_usd?.h24}`);
    result.set(attrs.address, {
      address: attrs.address,
      decimals: attrs.decimals,
      priceUsd: parseFloat(attrs.price_usd || "0"),
      marketCap: parseFloat(attrs.market_cap_usd || "0"),
      fullyDilutedValuation: parseFloat(attrs.fdv_usd || "0"),
      volume24h: parseFloat(attrs.volume_usd?.h24 || "0"),
    });
  }

  return result;
}

// https://docs.coingecko.com/v3.0.1/reference/coins-markets
async function fetchCgMarketData(
  cgIdToAddress: Record<string, string>,
): Promise<Map<string, Partial<TokenMarketDataInsert>>> {
  const result = new Map<string, Partial<TokenMarketDataInsert>>();

  const cgIds = Object.keys(cgIdToAddress);
  if (cgIds.length == 0) {
    return result;
  }

  const cgEndpoint = cg.getEndpoint(`/coins/markets`);
  cgEndpoint.search = new URLSearchParams({
    ids: cgIds.join(","),
    vs_currency: "usd",
    order: "market_cap_desc",
    price_change_percentage: "1h,24h,14d,30d,200d,1y",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (!resp.ok) {
    return result;
  }

  const res: CG_TokenMarketData[] = await resp.json();
  const addressLookup = Object.fromEntries(
    Object.entries(cgIdToAddress).map(([cgId, address]) => [cgId, address]),
  );

  for (const raw of res) {
    const address = addressLookup[raw.id];
    if (!address) continue;
    console.log(`[CGData] Token: ${address} (ID: ${raw.id}), MarketCap: ${raw.market_cap}, CircSupply: ${raw.circulating_supply}, TotalSupply: ${raw.total_supply}`);

    result.set(address, {
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
      atlDate: new Date(raw.atl_date),
      atlChangePercentage: raw.atl_change_percentage,
    });
  }

  return result;
}

async function fetchTokenMarketData(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const onchainData = await fetchOnchainMarketData(tokenAddresses);
  if (onchainData.size == 0) {
    return null;
  }

  const metaRows = await db
    .select({
      address: tokenMeta.address,
      coingeckoId: tokenMeta.coingeckoId,
    })
    .from(tokenMeta)
    .where(inArray(tokenMeta.address, tokenAddresses));

  const cgIdToAddress: Record<string, string> = {};
  for (const row of metaRows) {
    if (row.coingeckoId) {
      cgIdToAddress[row.coingeckoId] = row.address;
    }
  }
  console.log(`[TokenMarketData] Found CG IDs for: ${Object.keys(cgIdToAddress).join(", ")}`);

  const cgData = await fetchCgMarketData(cgIdToAddress);
  const marketDataList: TokenMarketDataInsert[] = [];

  for (const [address, onchainEntry] of onchainData) {
    const cgEntry = cgData.get(address) ?? {};
    marketDataList.push({
      address,
      decimals: onchainEntry.decimals!,
      priceUsd: onchainEntry.priceUsd!,
      marketCap: onchainEntry.marketCap!,
      fullyDilutedValuation: onchainEntry.fullyDilutedValuation!,
      volume24h: onchainEntry.volume24h!,
      priceChange24h: cgEntry.priceChange24h ?? null,
      priceChangePercentage1h: cgEntry.priceChangePercentage1h ?? null,
      priceChangePercentage24h: cgEntry.priceChangePercentage24h ?? null,
      priceChangePercentage14d: cgEntry.priceChangePercentage14d ?? null,
      priceChangePercentage30d: cgEntry.priceChangePercentage30d ?? null,
      priceChangePercentage200d: cgEntry.priceChangePercentage200d ?? null,
      priceChangePercentage1y: cgEntry.priceChangePercentage1y ?? null,
      marketCapChange24h: cgEntry.marketCapChange24h ?? null,
      marketCapChangePercentage24h:
        cgEntry.marketCapChangePercentage24h ?? null,
      circulatingSupply: cgEntry.circulatingSupply ?? null,
      totalSupply: cgEntry.totalSupply ?? null,
      maxSupply: cgEntry.maxSupply ?? null,
      ath: cgEntry.ath ?? null,
      athDate: cgEntry.athDate ?? null,
      athChangePercentage: cgEntry.athChangePercentage ?? null,
      atl: cgEntry.atl ?? null,
      atlDate: cgEntry.atlDate ?? null,
      atlChangePercentage: cgEntry.atlChangePercentage ?? null,
    });
  }

  if (marketDataList.length == 0) {
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

export async function getTokenMarketData(
  tokenAddresses: string[],
): Promise<TokenMarketDataInsert[]> {
  if (tokenAddresses.length == 0) {
    return [];
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
