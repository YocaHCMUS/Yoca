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

export async function getCoinGeckoIdsByAddresses(
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
    const addressToCgId = await fetchCoinGeckoIdsByAddresses(tokenAddresses);
    await db.update(coinGeckoTokenListMeta).set({
      lastRefresh: new Date(),
    });
    return addressToCgId;
  } else {
    const res = await db
      .select({
        id: coinGeckoTokenList.coinGeckoId,
        address: coinGeckoTokenList.tokenAddress,
      })
      .from(coinGeckoTokenList)
      .where(inArray(coinGeckoTokenList.tokenAddress, tokenAddresses))
      .limit(tokenAddresses.length);
    const addressToCgId = Object.fromEntries(
      res.map(({ id, address }) => [address, id]),
    );
    return addressToCgId;
  }
}

export async function getAddressesByCoinGeckoIds(
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

  if (res.length == 0) {
    const cgIdToAddress = await fetchAddressesByCoinGeckoIds(coinGeckoIds);
    return cgIdToAddress;
  }

  const cgIdToAddress = Object.fromEntries(
    res.map(({ id, address }) => [id, address]),
  );
  return cgIdToAddress;
}

export async function fetchCoinGeckoIdsByAddresses(
  tokenAddresses: string[],
): Promise<Record<string, string>> {
  if (tokenAddresses.length == 0) {
    return {};
  }

  const res = await cg.client.coins.list.get({
    include_platform: true,
  });

  const solanaTokens = res
    .filter((raw) => raw.platforms!.solana)
    .map(
      (rawToken): CoingeckoTokenListInsert => ({
        coinGeckoId: rawToken.id!,
        tokenAddress: rawToken.platforms!.solana!,
      }),
    );

  const addressToCgId = Object.fromEntries(
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

  return addressToCgId;
}

async function fetchAddressesByCoinGeckoIds(
  coinGeckoIds: string[],
): Promise<Record<string, string>> {
  if (coinGeckoIds.length == 0) {
    return {};
  }

  const res = await cg.client.coins.list.get({
    include_platform: true,
  });

  const solanaTokens = res
    .filter((rawToken) => rawToken.platforms!.solana)
    .map(
      (rawToken): CoingeckoTokenListInsert => ({
        coinGeckoId: rawToken.id!,
        tokenAddress: rawToken.platforms!.solana!,
      }),
    );

  const cgIdToAddress = Object.fromEntries(
    solanaTokens
      .filter((t) => coinGeckoIds.includes(t.coinGeckoId))
      .map(({ coinGeckoId, tokenAddress }) => [coinGeckoId, tokenAddress]),
  );

  if (solanaTokens.length > 0) {
    await db
      .insert(coinGeckoTokenList)
      .values(solanaTokens)
      .onConflictDoUpdate({
        target: [coinGeckoTokenList.tokenAddress],
        set: { tokenAddress: excluded(coinGeckoTokenList.tokenAddress) },
      });
  }

  return cgIdToAddress;
}
