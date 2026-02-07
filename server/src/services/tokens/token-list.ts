import { CG_TOKEN_LIST_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import {
  coinGeckoTokenList,
  coinGeckoTokenListMeta,
  type CoingeckoTokenListInsert,
} from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { inArray } from "drizzle-orm";
import type { CG_Token } from "../_types/token_raw_responses.js";

export async function getCoinGeckoIdList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const freshCheck = await db
    .select({
      lastRefresh: coinGeckoTokenListMeta.lastRefresh,
    })
    .from(coinGeckoTokenListMeta)
    .limit(1);

  const thresholdDate = new Date(Date.now() - CG_TOKEN_LIST_TTL_MS);

  if (freshCheck.length == 0 || freshCheck[0].lastRefresh < thresholdDate) {
    const idLookup = await fetchCgTokenList(tokenAddresses);
    await db.update(coinGeckoTokenListMeta).set({
      lastRefresh: new Date(),
    });
    return idLookup;
  } else {
    const res = await db
      .select({
        id: coinGeckoTokenList.coinGeckoId,
        address: coinGeckoTokenList.tokenAddress,
      })
      .from(coinGeckoTokenList)
      .where(inArray(coinGeckoTokenList.tokenAddress, tokenAddresses))
      .limit(tokenAddresses.length);
    const idLookup = Object.fromEntries(
      res.map(({ id, address }) => [address, id]),
    );
    return idLookup;
  }
}

export async function fetchCgTokenList(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return null;
  }

  const cgEndpoint = cg.getEndpoint("/coins/list");
  cgEndpoint.search = new URLSearchParams({
    include_platform: "true",
  }).toString();

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (resp.ok) {
    const res: CG_Token[] = await resp.json();
    const solanaTokens = res
      .filter((rawToken) => rawToken.platforms.solana)
      .map(
        (rawToken): CoingeckoTokenListInsert => ({
          coinGeckoId: rawToken.id,
          tokenAddress: rawToken.platforms.solana!,
        }),
      );

    const idLookup = Object.fromEntries(
      solanaTokens
        .filter((t) => tokenAddresses.includes(t.tokenAddress))
        .map(({ coinGeckoId, tokenAddress }) => [tokenAddress, coinGeckoId]),
    );

    if (solanaTokens.length > 0) {
      await db
        .insert(coinGeckoTokenList)
        .values(solanaTokens)
        .onConflictDoUpdate({
          target: [coinGeckoTokenList.tokenAddress],
          set: { coinGeckoId: excluded(coinGeckoTokenList.coinGeckoId) },
        });
    }

    return idLookup;
  } else {
    return null;
  }
}
