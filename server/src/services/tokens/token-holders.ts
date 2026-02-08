import { TOKEN_HOLDERS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenHolders, type TokenHolderInsert } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte } from "drizzle-orm";

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

/**
 * Fetch token holders info from CoinGecko API
 */
async function fetchTokenHoldersInfo(
    tokenAddress: string,
    network: string = "solana"
): Promise<TokenHolderInsert | null> {
    const cgEndpoint = cg.getEndpoint(
        `/onchain/networks/${network}/tokens/${tokenAddress}/info`
    );

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Token Holders API error: ${resp.status}`);
        return null;
    }

    const json: HoldersResponse = await resp.json();
    const data = json.data;
    const holders = data?.attributes?.holders || json.holders;

    if (!holders) {
        return null;
    }

    return {
        address: tokenAddress,
        network,
        holdersCount: Number(holders.count || 0),
        top10Percent: Number(holders.distribution_percentage?.top_10 || 0),
    };
}

/**
 * Get token holders info with caching
 */
export async function getTokenHoldersInfo(
    tokenAddress: string,
    network: string = "solana"
) {
    const thresholdDate = new Date(Date.now() - TOKEN_HOLDERS_TTL_MS);

    // Check cache
    const cached = await db
        .select()
        .from(tokenHolders)
        .where(
            and(
                eq(tokenHolders.address, tokenAddress),
                eq(tokenHolders.network, network),
                gte(tokenHolders.updatedAt, thresholdDate)
            )
        )
        .limit(1);

    if (cached.length > 0) {
        return cached[0];
    }

    // Fetch fresh data
    const holdersData = await fetchTokenHoldersInfo(tokenAddress, network);

    if (!holdersData) {
        return null;
    }

    // Store in database
    const inserted = await db
        .insert(tokenHolders)
        .values(holdersData)
        .onConflictDoUpdate({
            target: [tokenHolders.address],
            set: {
                holdersCount: excluded(tokenHolders.holdersCount),
                top10Percent: excluded(tokenHolders.top10Percent),
            },
        })
        .returning();

    return inserted[0];
}
