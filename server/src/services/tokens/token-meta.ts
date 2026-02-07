import { TOKEN_META_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  coinGeckoTokenList,
  tokenMeta,
  type TokenMetaInsert,
} from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte, inArray } from "drizzle-orm";
import type { CG_TokenMeta } from "../_types/token_raw_responses.js";
import { fetchCgTokenList, getCoinGeckoIdList } from "./token-list.js";

// Fetch token metadata from CoinGecko API and store in database
async function fetchTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const idLookup =
    (await getCoinGeckoIdList(tokenAddresses)) ??
    (await fetchCgTokenList(tokenAddresses));

  if (!idLookup) {
    return null;
  }

  const rawMetaList = await Promise.all(
    Object.values(idLookup)
      .filter((id) => id != null)
      .map(async (id) => {
        const cgEndpoint = cg.getEndpoint(`/coins/${id}`);
        const req = new Request(cgEndpoint, {
          method: "GET",
          headers: cg.getRequiredHeaders(),
        });

        const resp = await fetch(req);
        if (resp.ok) {
          const rawMeta: CG_TokenMeta = await resp.json();
          return rawMeta;
        } else {
          return null;
        }
      }),
  );

  const metaDataList = rawMetaList
    .filter((rawMeta) => rawMeta != null)
    .map(
      (rawMeta): TokenMetaInsert => ({
        address: rawMeta.platforms.solana,
        symbol: rawMeta.symbol,
        name: rawMeta.name,
        description: rawMeta.description?.en || null,
        imageUrl: rawMeta.image.small,
      }),
    );

  if (metaDataList.length === 0) {
    return [];
  }

  return await db
    .insert(tokenMeta)
    .values(metaDataList)
    .onConflictDoUpdate({
      target: [tokenMeta.address],
      set: {
        name: excluded(tokenMeta.name),
        symbol: excluded(tokenMeta.symbol),
        imageUrl: excluded(tokenMeta.imageUrl),
      },
    })
    .returning();
}

export async function getTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const thresholdDate = new Date(Date.now() - TOKEN_META_TTL_MS);

  const res = await db
    .select({
      address: tokenMeta.address,
      name: tokenMeta.name,
      symbol: tokenMeta.symbol,
      imageUrl: tokenMeta.imageUrl,
      description: tokenMeta.description,
      updatedAt: tokenMeta.updatedAt,
      coinGeckoId: coinGeckoTokenList.coinGeckoId,
    })
    .from(tokenMeta)
    .leftJoin(
      coinGeckoTokenList,
      eq(tokenMeta.address, coinGeckoTokenList.tokenAddress),
    )
    .where(
      and(
        gte(tokenMeta.updatedAt, thresholdDate),
        inArray(tokenMeta.address, tokenAddresses),
      ),
    )
    .limit(tokenAddresses.length);

  const metaDataLookup = Object.fromEntries(
    res.map((meta) => [meta.address, meta]),
  );

  const staleAddresses = tokenAddresses.filter(
    (address) => !metaDataLookup[address],
  );

  const refreshed = await fetchTokenMetaList(staleAddresses);

  if (!refreshed || refreshed.length == 0) {
    return res;
  } else {
    const refreshedWithIds = await db
      .select({
        address: tokenMeta.address,
        name: tokenMeta.name,
        symbol: tokenMeta.symbol,
        imageUrl: tokenMeta.imageUrl,
        description: tokenMeta.description,
        updatedAt: tokenMeta.updatedAt,
        coinGeckoId: coinGeckoTokenList.coinGeckoId,
      })
      .from(tokenMeta)
      .leftJoin(
        coinGeckoTokenList,
        eq(tokenMeta.address, coinGeckoTokenList.tokenAddress),
      )
      .where(
        inArray(
          tokenMeta.address,
          refreshed.map((r) => r.address),
        ),
      )
      .limit(refreshed.length);

    return [...res, ...refreshedWithIds];
  }
}
