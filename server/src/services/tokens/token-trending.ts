import { UPDATE_TRENDING_TOKENS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { trendingTokens } from "@sv/db/schema.js";
import * as bds from "@sv/util/util-birdeye.js";
import { asc } from "drizzle-orm";
import type { BDS_TrendingList } from "../_types/token_raw_responses.js";

// https://docs.birdeye.so/reference/get-defi-token_trending
export async function getTrendingTokens() {
  const result = await db
    .select()
    .from(trendingTokens)
    .orderBy(asc(trendingTokens.rank));

  const thresholdTime = new Date(Date.now() - UPDATE_TRENDING_TOKENS_TTL_MS);

  if (result.length > 0 && result[0].updatedAt > thresholdTime) {
    return result;
  }

  const bdsEndpoint = bds.getEndpoint("/defi/token_trending");

  bdsEndpoint.search = new URLSearchParams({
    sort_by: "rank",
    sort_type: "asc",
  }).toString();

  const req = new Request(bdsEndpoint, {
    method: "GET",
    headers: bds.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  if (!resp.ok) {
    return null;
  }

  const res: BDS_TrendingList = await resp.json();

  if (!res.success) {
    return null;
  }

  await db.delete(trendingTokens);
  return await db
    .insert(trendingTokens)
    .values(
      res.data.tokens.map((token) => ({
        address: token.address,
        rank: token.rank,
      })),
    )
    .returning();
}
