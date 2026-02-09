import { TOP_TOKEN_HOLDERS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { topTokenHolders } from "@sv/db/schema.js";
import * as mrl from "@sv/util/util-moralis.js";
import { and, gte, inArray } from "drizzle-orm";

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

  if (resp.ok) {
    const res = await resp.json();
  } else {
    return [];
  }
}

async function fetchTopHoldersForTokens(tokenAddresses: string[]) {
  const topHolders = tokenAddresses.map((tokenAddress) =>
    fetchTopHoldersForToken(tokenAddress),
  );
  return topHolders;
}

export async function getTopHoldersForTokens(tokenAddresses: string[]) {
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
  
  return 
}
