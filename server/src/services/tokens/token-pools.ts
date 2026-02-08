import { TOKEN_POOLS_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { tokenPools, type TokenPoolInsert } from "@sv/db/schema.js";
import { excluded } from "@sv/util/orm-sql.js";
import * as cg from "@sv/util/util-coingecko.js";
import { and, eq, gte } from "drizzle-orm";

interface PoolAttributes {
    name: string;
    address: string;
    volume_usd: Record<string, string>;
    buy_volume_usd: Record<string, string>;
    sell_volume_usd: Record<string, string>;
    net_buy_volume_usd: Record<string, string>;
    reserve_in_usd: string;
    market_cap_usd: string | null;
    fdv_usd: string | null;
    base_token_price_usd: string | null;
    quote_token_price_usd: string | null;
    base_token_price_quote_token: string | null;
    price_change_percentage: Record<string, string>;
    transactions: {
        h24: {
            buys: number;
            sells: number;
            buyers: number;
            sellers: number;
        };
    };
}

interface PoolResponse {
    data: Array<{
        attributes: PoolAttributes;
        relationships: {
            quote_token?: {
                data?: {
                    id: string;
                };
            };
            dex?: {
                data?: {
                    id: string;
                };
            };
        };
    }>;
    included?: Array<{
        type: string;
        id: string;
        attributes: {
            name?: string;
            symbol?: string;
        };
    }>;
}

/**
 * Fetch token pools from CoinGecko API
 */
async function fetchTokenPools(
    tokenAddress: string,
    network: string = "solana",
    limit: number = 20
): Promise<TokenPoolInsert[]> {
    const cgEndpoint = cg.getEndpoint(
        `/onchain/networks/${network}/tokens/${tokenAddress}/pools`
    );

    cgEndpoint.search = new URLSearchParams({
        include: "base_token,dex",
        sort: "h24_volume_usd_desc",
    }).toString();

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Token Pools API error: ${resp.status}`);
        return [];
    }

    const json: PoolResponse = await resp.json();
    const pools = json.data || [];
    const included = json.included || [];

    return pools.slice(0, limit).map((pool) => {
        const quoteTokenId = pool.relationships?.quote_token?.data?.id as string;
        const isQuote = quoteTokenId && quoteTokenId.endsWith(tokenAddress);

        const attrs = pool.attributes;
        const h24Txns = attrs.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };

        const dexId = pool.relationships?.dex?.data?.id;
        let source = dexId || "unknown";

        if (dexId) {
            const foundDex = included.find((item) => item.type === "dex" && item.id === dexId);
            if (foundDex?.attributes?.name) {
                source = foundDex.attributes.name;
            }
        }

        // Find quote token symbol
        let quoteTokenSymbol = "SOL"; // default
        if (quoteTokenId) {
            const foundToken = included.find((item) => item.type === "token" && item.id === quoteTokenId);
            if (foundToken?.attributes?.symbol) {
                quoteTokenSymbol = foundToken.attributes.symbol;
            }
        }

        return {
            address: attrs.address || "",
            tokenAddress,
            network,
            name: attrs.name || "Unknown Pool",
            source,
            volume24h: parseFloat(attrs.volume_usd?.h24 || "0"),
            volumeBuy24h: parseFloat(attrs.buy_volume_usd?.h24 || "0"),
            volumeSell24h: parseFloat(attrs.sell_volume_usd?.h24 || "0"),
            volumeNet24h: parseFloat(attrs.net_buy_volume_usd?.h24 || "0"),
            reserve: parseFloat(attrs.reserve_in_usd || "0"),
            liquidity: parseFloat(attrs.reserve_in_usd || "0"),
            marketCap: parseFloat(attrs.market_cap_usd || "0"),
            fdv: parseFloat(attrs.fdv_usd || "0"),
            priceUsd: parseFloat((isQuote ? attrs.quote_token_price_usd : attrs.base_token_price_usd) || "0"),
            priceQuoteToken: parseFloat(attrs.base_token_price_quote_token || "0"),
            quoteTokenSymbol,
            priceChangeM5: parseFloat(attrs.price_change_percentage?.m5 || "0"),
            priceChangeH1: parseFloat(attrs.price_change_percentage?.h1 || "0"),
            priceChangeH6: parseFloat(attrs.price_change_percentage?.h6 || "0"),
            priceChangeH24: parseFloat(attrs.price_change_percentage?.h24 || "0"),
            txns24h: (h24Txns.buys || 0) + (h24Txns.sells || 0),
            buys24h: h24Txns.buys || 0,
            sells24h: h24Txns.sells || 0,
            traders24h: (h24Txns.buyers || 0) + (h24Txns.sellers || 0),
            buyers24h: h24Txns.buyers || 0,
            sellers24h: h24Txns.sellers || 0,
        };
    });
}

/**
 * Get token pools with caching
 */
export async function getTokenPools(
    tokenAddress: string,
    network: string = "solana",
    limit: number = 20
) {
    const thresholdDate = new Date(Date.now() - TOKEN_POOLS_TTL_MS);

    // Check cache
    const cached = await db
        .select()
        .from(tokenPools)
        .where(
            and(
                eq(tokenPools.tokenAddress, tokenAddress),
                eq(tokenPools.network, network),
                gte(tokenPools.updatedAt, thresholdDate)
            )
        )
        .limit(limit);

    if (cached.length > 0) {
        return cached;
    }

    // Fetch fresh data
    const poolsData = await fetchTokenPools(tokenAddress, network, limit);

    if (poolsData.length === 0) {
        return [];
    }

    // Store in database
    const inserted = await db
        .insert(tokenPools)
        .values(poolsData)
        .onConflictDoUpdate({
            target: [tokenPools.address],
            set: {
                name: excluded(tokenPools.name),
                source: excluded(tokenPools.source),
                volume24h: excluded(tokenPools.volume24h),
                volumeBuy24h: excluded(tokenPools.volumeBuy24h),
                volumeSell24h: excluded(tokenPools.volumeSell24h),
                volumeNet24h: excluded(tokenPools.volumeNet24h),
                reserve: excluded(tokenPools.reserve),
                liquidity: excluded(tokenPools.liquidity),
                marketCap: excluded(tokenPools.marketCap),
                fdv: excluded(tokenPools.fdv),
                priceUsd: excluded(tokenPools.priceUsd),
                priceQuoteToken: excluded(tokenPools.priceQuoteToken),
                quoteTokenSymbol: excluded(tokenPools.quoteTokenSymbol),
                priceChangeM5: excluded(tokenPools.priceChangeM5),
                priceChangeH1: excluded(tokenPools.priceChangeH1),
                priceChangeH6: excluded(tokenPools.priceChangeH6),
                priceChangeH24: excluded(tokenPools.priceChangeH24),
                txns24h: excluded(tokenPools.txns24h),
                buys24h: excluded(tokenPools.buys24h),
                sells24h: excluded(tokenPools.sells24h),
                traders24h: excluded(tokenPools.traders24h),
                buyers24h: excluded(tokenPools.buyers24h),
                sellers24h: excluded(tokenPools.sellers24h),
            },
        })
        .returning();

    return inserted;
}

/**
 * Get single pool details
 */
export async function getPoolDetails(
    poolAddress: string,
    network: string = "solana"
) {
    const thresholdDate = new Date(Date.now() - TOKEN_POOLS_TTL_MS);

    // Check cache
    const cached = await db
        .select()
        .from(tokenPools)
        .where(
            and(
                eq(tokenPools.address, poolAddress),
                eq(tokenPools.network, network),
                gte(tokenPools.updatedAt, thresholdDate)
            )
        )
        .limit(1);

    if (cached.length > 0) {
        return cached[0];
    }

    // Fetch from API
    const cgEndpoint = cg.getEndpoint(
        `/onchain/networks/${network}/pools/${poolAddress}`
    );

    cgEndpoint.search = new URLSearchParams({
        include: "base_token,quote_token,dex",
    }).toString();

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Pool Details API error: ${resp.status}`);
        return null;
    }

    const json = await resp.json();
    const pool = json.data;
    if (!pool) return null;

    const attrs = pool.attributes;
    const h24Txns = attrs.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };

    // Parse quote token symbol from included
    let quoteTokenSymbol = "SOL";
    const quoteTokenId = pool.relationships?.quote_token?.data?.id;
    if (quoteTokenId && json.included) {
        const found = json.included.find((item: any) => item.type === "token" && item.id === quoteTokenId);
        if (found?.attributes?.symbol) {
            quoteTokenSymbol = found.attributes.symbol;
        }
    }

    const dexSource = json.included?.find((item: any) => item.type === "dex")?.attributes?.name || "unknown";

    const poolData: TokenPoolInsert = {
        address: attrs.address || poolAddress,
        tokenAddress: attrs.base_token_address || "",
        network,
        name: attrs.name || "Unknown Pool",
        source: dexSource,
        volume24h: parseFloat(attrs.volume_usd?.h24 || "0"),
        volumeBuy24h: parseFloat(attrs.buy_volume_usd?.h24 || "0"),
        volumeSell24h: parseFloat(attrs.sell_volume_usd?.h24 || "0"),
        volumeNet24h: parseFloat(attrs.net_buy_volume_usd?.h24 || "0"),
        reserve: parseFloat(attrs.reserve_in_usd || "0"),
        liquidity: parseFloat(attrs.reserve_in_usd || "0"),
        marketCap: parseFloat(attrs.market_cap_usd || "0"),
        fdv: parseFloat(attrs.fdv_usd || "0"),
        priceUsd: parseFloat(attrs.base_token_price_usd || "0"),
        priceQuoteToken: parseFloat(attrs.base_token_price_quote_token || "0"),
        quoteTokenSymbol,
        priceChangeM5: parseFloat(attrs.price_change_percentage?.m5 || "0"),
        priceChangeH1: parseFloat(attrs.price_change_percentage?.h1 || "0"),
        priceChangeH6: parseFloat(attrs.price_change_percentage?.h6 || "0"),
        priceChangeH24: parseFloat(attrs.price_change_percentage?.h24 || "0"),
        txns24h: (h24Txns.buys || 0) + (h24Txns.sells || 0),
        buys24h: h24Txns.buys || 0,
        sells24h: h24Txns.sells || 0,
        traders24h: (h24Txns.buyers || 0) + (h24Txns.sellers || 0),
        buyers24h: h24Txns.buyers || 0,
        sellers24h: h24Txns.sellers || 0,
    };

    // Store in database
    const inserted = await db
        .insert(tokenPools)
        .values(poolData)
        .onConflictDoUpdate({
            target: [tokenPools.address],
            set: {
                name: excluded(tokenPools.name),
                source: excluded(tokenPools.source),
                volume24h: excluded(tokenPools.volume24h),
                volumeBuy24h: excluded(tokenPools.volumeBuy24h),
                volumeSell24h: excluded(tokenPools.volumeSell24h),
                volumeNet24h: excluded(tokenPools.volumeNet24h),
                reserve: excluded(tokenPools.reserve),
                liquidity: excluded(tokenPools.liquidity),
                marketCap: excluded(tokenPools.marketCap),
                fdv: excluded(tokenPools.fdv),
                priceUsd: excluded(tokenPools.priceUsd),
                priceQuoteToken: excluded(tokenPools.priceQuoteToken),
                quoteTokenSymbol: excluded(tokenPools.quoteTokenSymbol),
                priceChangeM5: excluded(tokenPools.priceChangeM5),
                priceChangeH1: excluded(tokenPools.priceChangeH1),
                priceChangeH6: excluded(tokenPools.priceChangeH6),
                priceChangeH24: excluded(tokenPools.priceChangeH24),
                txns24h: excluded(tokenPools.txns24h),
                buys24h: excluded(tokenPools.buys24h),
                sells24h: excluded(tokenPools.sells24h),
                traders24h: excluded(tokenPools.traders24h),
                buyers24h: excluded(tokenPools.buyers24h),
                sellers24h: excluded(tokenPools.sellers24h),
            },
        })
        .returning();

    return inserted[0];
}
