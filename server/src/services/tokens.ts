import { db } from "@db/index.js";
import { coinGeckoTokenList, tokenMeta, type TokenMetaSelect } from "@db/schema.js";
import { eq, sql } from "drizzle-orm";
import * as cg from "@util/util-coingecko.js";

interface Token {
  id: string;
  name: string;
  symbol: string;
  platforms: { solana?: string };
}

export async function getCoinGeckoId(tokenAddress: string) {
  const result = await db
    .select({
      coinGeckoId: coinGeckoTokenList.coinGeckoId,
    })
    .from(coinGeckoTokenList)
    .where(eq(coinGeckoTokenList.tokenAddress, tokenAddress));

  if (result.length == 0) {
    return null;
  } else {
    return result[0];
  }
}

export async function fetchTokenMeta(tokenAddress: string) {
  let cgIdResult = await getCoinGeckoId(tokenAddress);
  if (cgIdResult == null) {
    // Blind trust
    cgIdResult = {
      coinGeckoId: (await pullCgTokenList(tokenAddress))!,
    };
  
  const cgId = cgIdResult.coinGeckoId;

  const cgEndpoint = cg.getEndpoint(`/coins/${cgId}`);

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);
  if (resp.ok) {
    const result = await resp.json();
    
    await db.insert(tokenMeta).values([{
      address: tokenAddress,
      name: result.name!,
      symbol: result.symbol,
    }]);
  } else {
  }

  return cgIdResult;
}

export async function getTokenMeta(tokenAddress: string) {
  const result = await db
    .select()
    .from(tokenMeta)
    .where(eq(tokenMeta.address, tokenAddress));
  // With ORM like query you can have easier typesafe relation with "with"
  // const result = await db.query.tokenMarketData.findMany({
  //   where: eq(tokenMeta.address, tokenAddress),
  //   with: {
  //     tokenMeta: true,
  //   },
  // });

  if (result.length == 0) {
    return null;
  } else {
    return result;
  }
}

async function pullCgTokenList(tokenAddress: string): Promise<string | null> {
  const cgEndpoint = cg.getEndpoint("/coins/list");
  cgEndpoint.searchParams.append("include_platform", "true");

  const req = new Request(cgEndpoint, {
    method: "GET",
    headers: cg.getRequiredHeaders(),
  });

  const resp = await fetch(req);

  let cgId = null;
  if (resp.ok) {
    const res = await resp.json();
    const solanaTokens = (res.data as Token[])
      .filter((rawToken) => rawToken.platforms.solana)
      .map((rawToken) => {
        if (rawToken.platforms.solana! == tokenAddress) {
          cgId = rawToken.id;
        }
        return {
          coinGeckoId: rawToken.id,
          tokenAddress: rawToken.platforms.solana!,
        };
      });
    await db
      .insert(coinGeckoTokenList)
      .values(solanaTokens)
      .onConflictDoUpdate({
        target: coinGeckoTokenList.tokenAddress,
        set: { coinGeckoId: sql<string>`excluded.coin_gecko_id` },
      });
  }
  return cgId;
}
