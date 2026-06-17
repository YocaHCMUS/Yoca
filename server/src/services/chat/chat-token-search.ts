import { db } from "@sv/db/index.js";
import { tokenMeta } from "@sv/db/schema.js";
import { getAddressesByCoinGeckoIds } from "@sv/services/tokens/token-list.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, gte, or, sql } from "drizzle-orm";
import { TOKEN_DETAILS_TTL_MS } from "@sv/config/constants.js";

export interface TokenSearchResult {
  address: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
}

async function searchLocal(query: string): Promise<TokenSearchResult[]> {
  const thresholdDate = new Date(Date.now() - TOKEN_DETAILS_TTL_MS);
  const pattern = `%${query}%`;

  const rows = await db
    .select({
      address: tokenMeta.address,
      symbol: tokenMeta.symbol,
      name: tokenMeta.name,
      imageUrl: tokenMeta.imageUrl,
    })
    .from(tokenMeta)
    .where(
      and(
        gte(tokenMeta.updatedAt, thresholdDate),
        or(
          sql`${tokenMeta.symbol} ILIKE ${pattern}`,
          sql`${tokenMeta.name} ILIKE ${pattern}`,
        ),
      ),
    )
    .limit(20);

  return rows.map((r) => ({
    address: r.address,
    symbol: r.symbol,
    name: r.name,
    imageUrl: r.imageUrl ?? null,
  }));
}

async function searchCoinGecko(query: string): Promise<TokenSearchResult[]> {
  try {
    const res = await cg.client.search.get({ query });
    const coins = res.coins ?? [];
    if (coins.length === 0) return [];

    const cgIds = coins.map((c) => c.id!).filter(Boolean);
    if (cgIds.length === 0) return [];

    const cgIdToAddress = await getAddressesByCoinGeckoIds(cgIds);

    return coins
      .filter((c) => c.id && cgIdToAddress[c.id])
      .map((c) => ({
        address: cgIdToAddress[c.id!],
        symbol: c.symbol ?? "",
        name: c.name ?? null,
        imageUrl: c.large ?? c.thumb ?? null,
      }));
  } catch {
    return [];
  }
}

export async function searchToken(query: string): Promise<TokenSearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const local = await searchLocal(q);
  if (local.length > 0) return local;

  return await searchCoinGecko(q);
}
