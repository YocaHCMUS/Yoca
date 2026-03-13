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

// Canonical wrapped/native SOL mint on Solana.
const SOL_MINT = "So11111111111111111111111111111111111111112";
const SOL_COINGECKO_ID = "solana";

function withSolFallback(
  tokenAddresses: string[],
  idLookup: Record<string, string>,
): Record<string, string> {
  const next = { ...idLookup };
  if (tokenAddresses.includes(SOL_MINT) && !next[SOL_MINT]) {
    next[SOL_MINT] = SOL_COINGECKO_ID;
  }
  return next;
}

export async function getCoinGeckoIdList(
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  if (tokenAddresses.length == 0) {
    return {};
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
    return withSolFallback(tokenAddresses, idLookup);
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
    return withSolFallback(tokenAddresses, idLookup);
  }
}

export async function getAddressesByCoinGeckoId(
  coinGeckoIds: string[],
): Promise<Record<string, string>> {
  if (coinGeckoIds.length == 0) {
    return {};
  }

  const res = await db
    .select({
      id: coinGeckoTokenList.coinGeckoId,
      address: coinGeckoTokenList.tokenAddress,
    })
    .from(coinGeckoTokenList)
    .where(inArray(coinGeckoTokenList.coinGeckoId, coinGeckoIds))
    .limit(coinGeckoIds.length);

  const addressLookup = Object.fromEntries(
    res.map(({ id, address }) => [id, address]),
  );
  return addressLookup;
}

export async function fetchCgTokenList(
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  if (tokenAddresses.length == 0) {
    return {};
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

    return withSolFallback(tokenAddresses, idLookup);
  } else {
    return withSolFallback(tokenAddresses, {});
  }
}
