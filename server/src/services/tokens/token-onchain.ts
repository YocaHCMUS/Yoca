import { ONCHAIN_TOKEN_DATA_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { onchainTokenData, type OnchainTokenDataInsert } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte } from "drizzle-orm";

interface OnchainTokenResponse {
    data: {
        attributes: {
            name: string;
            symbol: string;
            address: string;
            price_usd: string;
            market_cap_usd: string;
            fdv_usd: string;
            total_supply: string;
            normalized_total_supply: string;
            volume_usd: Record<string, string>;
            price_change_percentage: Record<string, string>;
            total_reserve_in_usd: string;
        };
    };
    included?: Array<{
        attributes: {
            transactions: {
                h24: {
                    buys: number;
                    sells: number;
                    buyers: number;
                    sellers: number;
                };
            };
            volume_usd: Record<string, string>;
            price_change_percentage: Record<string, string>;
        };
    }>;
}

/**
 * Fetch onchain token data from CoinGecko API
 */
async function fetchOnchainTokenData(
    tokenAddress: string,
    network: string = "solana"
): Promise<OnchainTokenDataInsert | null> {
    const cgEndpoint = cg.getEndpoint(
        `/onchain/networks/${network}/tokens/${tokenAddress}`
    );

    cgEndpoint.search = new URLSearchParams({
        include: "top_pools",
    }).toString();

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Onchain Token API error: ${resp.status}`);
        return null;
    }

    const json: OnchainTokenResponse = await resp.json();
    const token = json.data?.attributes;

    if (!token) return null;

    const volumeUsd = token.volume_usd || {};
    const priceChange = token.price_change_percentage || {};

    // Get top pool data from included array
    const topPool = json.included?.[0]?.attributes;
    const poolTxs24h = topPool?.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };
    const poolVolume = topPool?.volume_usd || {};

    return {
        address: token.address || tokenAddress,
        network,
        name: token.name || "Unknown",
        symbol: token.symbol || "",
        priceUsd: parseFloat(token.price_usd || "0"),
        marketCapUsd: parseFloat(token.market_cap_usd || "0"),
        fdvUsd: parseFloat(token.fdv_usd || "0"),
        totalSupply: parseFloat(token.normalized_total_supply || token.total_supply || "0"),
        volume5m: parseFloat(volumeUsd.m5 || "0"),
        volume1h: parseFloat(volumeUsd.h1 || "0"),
        volume24h: parseFloat(volumeUsd.h24 || "0"),
        priceChange5m: parseFloat(topPool?.price_change_percentage?.m5 || priceChange.m5 || "0"),
        priceChange1h: parseFloat(topPool?.price_change_percentage?.h1 || priceChange.h1 || "0"),
        priceChange24h: parseFloat(topPool?.price_change_percentage?.h24 || priceChange.h24 || "0"),
        totalTxn24h: (poolTxs24h.buys || 0) + (poolTxs24h.sells || 0),
        buyTxn24h: poolTxs24h.buys || 0,
        sellTxn24h: poolTxs24h.sells || 0,
        uniqueBuyers24h: poolTxs24h.buyers || 0,
        uniqueSellers24h: poolTxs24h.sellers || 0,
        poolVolume24h: parseFloat(poolVolume.h24 || "0"),
        totalLiquidityUsd: parseFloat(token.total_reserve_in_usd || "0"),
    };
}

/**
 * Get onchain token data with caching
 */
export async function getOnchainTokenData(
    tokenAddress: string,
    network: string = "solana"
) {
    const thresholdDate = new Date(Date.now() - ONCHAIN_TOKEN_DATA_TTL_MS);

    // Check cache
    const cached = await db
        .select()
        .from(onchainTokenData)
        .where(
            and(
                eq(onchainTokenData.address, tokenAddress),
                eq(onchainTokenData.network, network),
                gte(onchainTokenData.updatedAt, thresholdDate)
            )
        )
        .limit(1);

    if (cached.length > 0) {
        return cached[0];
    }

    // Fetch fresh data
    const tokenData = await fetchOnchainTokenData(tokenAddress, network);

    if (!tokenData) {
        return null;
    }

    // Store in database
    const inserted = await db
        .insert(onchainTokenData)
        .values(tokenData)
        .onConflictDoUpdate({
            target: [onchainTokenData.address],
            set: {
                name: excluded(onchainTokenData.name),
                symbol: excluded(onchainTokenData.symbol),
                priceUsd: excluded(onchainTokenData.priceUsd),
                marketCapUsd: excluded(onchainTokenData.marketCapUsd),
                fdvUsd: excluded(onchainTokenData.fdvUsd),
                totalSupply: excluded(onchainTokenData.totalSupply),
                volume5m: excluded(onchainTokenData.volume5m),
                volume1h: excluded(onchainTokenData.volume1h),
                volume24h: excluded(onchainTokenData.volume24h),
                priceChange5m: excluded(onchainTokenData.priceChange5m),
                priceChange1h: excluded(onchainTokenData.priceChange1h),
                priceChange24h: excluded(onchainTokenData.priceChange24h),
                totalTxn24h: excluded(onchainTokenData.totalTxn24h),
                buyTxn24h: excluded(onchainTokenData.buyTxn24h),
                sellTxn24h: excluded(onchainTokenData.sellTxn24h),
                uniqueBuyers24h: excluded(onchainTokenData.uniqueBuyers24h),
                uniqueSellers24h: excluded(onchainTokenData.uniqueSellers24h),
                poolVolume24h: excluded(onchainTokenData.poolVolume24h),
                totalLiquidityUsd: excluded(onchainTokenData.totalLiquidityUsd),
            },
        })
        .returning();

    return inserted[0];
}
