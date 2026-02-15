import { TOP_TOKEN_HOLDERS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { topTokenHolders, type TokenTopHolderInsert } from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as mrl from "@sv/util/util-moralis.js";
import { and, gte, inArray } from "drizzle-orm";
import type { MRL_TopHolders } from "../_types/token_raw_responses.js";

interface HoldersResponse {
  data?: {
    attributes?: {
      holders?: {
        count: number;
        distribution_percentage?: {
          top_10: number;
        };
      };
    };
  };
  holders?: {
    count: number;
    distribution_percentage?: {
      top_10: number;
    };
  };
}

export interface TopHolder {
  ownerAddress: string;
  balance: string;
  balanceFormatted: string;
  percentageOfSupply: number;
  usdValue: number;
}

async function fetchTopHoldersForToken(tokenAddress: string) {
  const defaultLimit = 10;
  const mrlUrl = mrl.getEndpoint(
    `/token/mainnet/${tokenAddress}/top-holders?limit=${defaultLimit}`,
  );
  const resp = await fetch(mrlUrl, {
    method: "GET",
    headers: mrl.getRequiredHeaders(),
  });

  if (!resp.ok) {
    return [];
  }
  const res: MRL_TopHolders = await resp.json();
  const topHolders = res.result.map(
    (raw, idx): TokenTopHolderInsert => ({
      holderAddress: raw.ownerAddress,
      tokenAddress: tokenAddress,
      rank: idx,
    }),
  );

  return await db
    .insert(topTokenHolders)
    .values(topHolders)
    .onConflictDoUpdate({
      target: [topTokenHolders.tokenAddress, topTokenHolders.rank],
      set: excludedAuto(topTokenHolders, [
        topTokenHolders.tokenAddress,
        topTokenHolders.rank,
      ]),
    })
    .returning();
}

async function fetchTopHoldersForTokens(tokenAddresses: string[]) {
  if (tokenAddresses.length == 0) {
    return [];
  }
  const topHolders = await Promise.all(
    tokenAddresses.map((tokenAddress) => fetchTopHoldersForToken(tokenAddress)),
  );
  return topHolders;
}

export async function getTopTokenHolders(tokenAddresses: string[]) {
  const thresholdDate = new Date(Date.now() - TOP_TOKEN_HOLDERS_TTL_MS);

  const res = await db
    .select()
    .from(topTokenHolders)
    .where(
      and(
        gte(topTokenHolders.updatedAt, thresholdDate),
        inArray(topTokenHolders.tokenAddress, tokenAddresses),
      ),
    );

  const tokenAddressesToTopHolders = Object.fromEntries(
    res.map((topHolders) => [topHolders.tokenAddress, topHolders]),
  );
  const staleTokenAddresses = tokenAddresses.filter(
    (address) => !tokenAddressesToTopHolders[address],
  );
  const refreshed = await fetchTopHoldersForTokens(staleTokenAddresses);

  if (staleTokenAddresses.length > 0) {
    return [...res, ...refreshed];
  }

  return res;
}
