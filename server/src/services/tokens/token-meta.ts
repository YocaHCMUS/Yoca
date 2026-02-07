import { TOKEN_META_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenMeta, type TokenMetaInsert } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, inArray } from "drizzle-orm";
import type { CG_TokenMeta } from "../_types/token_raw_responses.js";
import { fetchCgTokenList, getCoinGeckoIdList } from "./token-list.js";

// https://docs.coingecko.com/v3.0.1/reference/coins-id
async function fetchTokenMetaList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return [];
  }

  const idLookup =
    (await getCoinGeckoIdList(tokenAddresses)) ??
    (await fetchCgTokenList(tokenAddresses));

  const rawMetaList = await Promise.all(
    Object.values(idLookup).map(async (id) => {
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
        linkHomepage: rawMeta.links?.homepage?.at(0) || null,
        linkDiscord: rawMeta.links?.chat_url?.at(0) || null,
        twitterScreenName: rawMeta.links?.twitter_screen_name || null,
        coinGeckoId: rawMeta.id,
      }),
    );

  if (metaDataList.length == 0) {
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
      .select()
      .from(tokenMeta)
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
