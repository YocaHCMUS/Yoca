import { TOP_TOKEN_HOLDERS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { topTokenHolders, type TokenTopHolderInsert } from "@sv/db/schema.js";
import { excludedAuto } from "@sv/util/orm-sql.js";
import * as mrl from "@sv/util/util-moralis.js";
import { eq } from "drizzle-orm";
import type { MRL_TopHolders } from "../_types/token_raw_responses.js";

// https://docs.moralis.com/web3-data-api/solana/reference/get-token-top-holders
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

  if (res.result.length == 0) {
    return [];
  }

  const topHolders = res.result.map(
    (raw, idx): TokenTopHolderInsert => ({
      holderAddress: raw.ownerAddress,
      tokenAddress: tokenAddress,
      rank: idx,
      percentage: Number(raw.percentageRelativeToTotalSupply),
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

export async function getTopTokenHolders(tokenAddress: string) {
  const res = await db
    .select()
    .from(topTokenHolders)
    .where(eq(topTokenHolders.tokenAddress, tokenAddress))
    .orderBy(topTokenHolders.rank);

  let stale = false;

  if (res.length > 0) {
    const latestUpdate = res.reduce((latest, cur) =>
      cur.updatedAt > latest.updatedAt ? cur : latest,
    );

    const thresholdDate = new Date(Date.now() - TOP_TOKEN_HOLDERS_TTL_MS);
    stale = latestUpdate.updatedAt < thresholdDate;
  } else {
    stale = true;
  }

  if (stale) {
    return await fetchTopHoldersForToken(tokenAddress);
  }
  return res;
}
