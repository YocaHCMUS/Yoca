import * as cg from "@sv/util/util-coingecko.js";

// Interface for pool data from CoinGecko onchain API
export interface PoolData {
    id: string;
    name: string;
    address: string;
    dex: string;
    baseTokenSymbol: string;
    quoteTokenSymbol: string;
    priceUsd: string;
    volumeUsd24h: string;
    reserveInUsd: string;
    priceChangeH1: string;
    priceChangeH24: string;
    poolCreatedAt: string;
}

interface CG_PoolResponse {
    data: {
        id: string;
        type: string;
        attributes: {
            address: string;
            name: string;
            token_price_usd: string;
            reserve_in_usd: string;
            pool_created_at: string;
            price_change_percentage: {
                m5: string;
                m15: string;
                m30: string;
                h1: string;
                h6: string;
                h24: string;
            };
            volume_usd: {
                m5: string;
                m15: string;
                m30: string;
                h1: string;
                h6: string;
                h24: string;
            };
        };
        relationships: {
            base_token: { data: { id: string; type: string } };
            quote_token: { data: { id: string; type: string } };
            dex: { data: { id: string; type: string } };
        };
    }[];
    included?: {
        id: string;
        type: string;
        attributes: {
            address: string;
            name: string;
            symbol: string;
        };
    }[];
}

export async function getTopPoolsByToken(
    tokenAddress: string,
    limit: number = 10
): Promise<PoolData[]> {
    const cgEndpoint = cg.getOnchainEndpoint(
        `/networks/solana/tokens/${tokenAddress}/pools`
    );

    cgEndpoint.search = new URLSearchParams({
        include: "base_token,quote_token,dex",
        sort: "h24_volume_usd_desc",
        page: "1",
    }).toString();

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Failed to fetch pools: ${resp.status}`);
        return [];
    }

    const res: CG_PoolResponse = await resp.json();

    // Build token lookup from included data
    const tokenLookup: Record<string, { name: string; symbol: string }> = {};
    if (res.included) {
        for (const token of res.included) {
            if (token.type === "token") {
                tokenLookup[token.id] = {
                    name: token.attributes.name,
                    symbol: token.attributes.symbol,
                };
            }
        }
    }

    // Map response to PoolData format
    const pools: PoolData[] = res.data.slice(0, limit).map((pool) => {
        const baseTokenId = pool.relationships?.base_token?.data?.id || "";
        const quoteTokenId = pool.relationships?.quote_token?.data?.id || "";
        const baseToken = tokenLookup[baseTokenId];
        const quoteToken = tokenLookup[quoteTokenId];

        return {
            id: pool.id,
            name: pool.attributes.name,
            address: pool.attributes.address,
            dex: pool.relationships?.dex?.data?.id || "unknown",
            baseTokenSymbol: baseToken?.symbol || "???",
            quoteTokenSymbol: quoteToken?.symbol || "???",
            priceUsd: pool.attributes.token_price_usd || "0",
            volumeUsd24h: pool.attributes.volume_usd?.h24 || "0",
            reserveInUsd: pool.attributes.reserve_in_usd || "0",
            priceChangeH1: pool.attributes.price_change_percentage?.h1 || "0",
            priceChangeH24: pool.attributes.price_change_percentage?.h24 || "0",
            poolCreatedAt: pool.attributes.pool_created_at || "",
        };
    });

    return pools;
}

// Pool Detail interface
export interface PoolDetail {
    id: string;
    name: string;
    address: string;
    dex: string;
    baseTokenSymbol: string;
    baseTokenAddress: string;
    quoteTokenSymbol: string;
    quoteTokenAddress: string;
    priceUsd: string;
    reserveInUsd: string;
    fdvUsd: string;
    marketCapUsd: string;
    volumeUsd: {
        m30: string;
        h1: string;
        h6: string;
        h24: string;
    };
    priceChangePercentage: {
        m30: string;
        h1: string;
        h6: string;
        h24: string;
    };
    transactions: {
        h24: {
            buys: number;
            sells: number;
            buyers: number;
            sellers: number;
        };
    };
    poolCreatedAt: string;
}

// Trade interface
export interface Trade {
    id: string;
    blockTimestamp: string;
    kind: string;
    volumeInUsd: string;
    priceFromInUsd: string;
    priceToInUsd: string;
    fromTokenAmount: string;
    toTokenAmount: string;
    fromTokenAddress: string;
    toTokenAddress: string;
    txFromAddress: string;
    txHash: string;
}

interface CG_PoolDetailResponse {
    data: {
        id: string;
        type: string;
        attributes: {
            address: string;
            name: string;
            base_token_price_usd: string;  // Base token price (memecoin)
            quote_token_price_usd: string; // Quote token price (SOL)
            token_price_usd: string;       // Same as quote token price
            reserve_in_usd: string;
            fdv_usd: string;
            market_cap_usd: string;
            pool_created_at: string;
            price_change_percentage: {
                m5: string;
                m15: string;
                m30: string;
                h1: string;
                h6: string;
                h24: string;
            };
            volume_usd: {
                m5: string;
                m15: string;
                m30: string;
                h1: string;
                h6: string;
                h24: string;
            };
            transactions: {
                m5: { buys: number; sells: number; buyers: number; sellers: number };
                m15: { buys: number; sells: number; buyers: number; sellers: number };
                m30: { buys: number; sells: number; buyers: number; sellers: number };
                h1: { buys: number; sells: number; buyers: number; sellers: number };
                h6: { buys: number; sells: number; buyers: number; sellers: number };
                h24: { buys: number; sells: number; buyers: number; sellers: number };
            };
        };
        relationships: {
            base_token: { data: { id: string; type: string } };
            quote_token: { data: { id: string; type: string } };
            dex: { data: { id: string; type: string } };
        };
    };
    included?: {
        id: string;
        type: string;
        attributes: {
            address: string;
            name: string;
            symbol: string;
        };
    }[];
}

interface CG_TradesResponse {
    data: {
        id: string;
        type: string;
        attributes: {
            block_timestamp: string;
            kind: string;
            volume_in_usd: string;
            price_from_in_usd: string;
            price_to_in_usd: string;
            from_token_amount: string;
            to_token_amount: string;
            from_token_address: string;
            to_token_address: string;
            tx_from_address: string;
            tx_hash: string;
        };
    }[];
}

export async function getPoolDetails(poolAddress: string): Promise<PoolDetail | null> {
    const cgEndpoint = cg.getOnchainEndpoint(`/networks/solana/pools/${poolAddress}`);

    cgEndpoint.search = new URLSearchParams({
        include: "base_token,quote_token,dex",
    }).toString();

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Failed to fetch pool details: ${resp.status}`);
        return null;
    }

    const res: CG_PoolDetailResponse = await resp.json();
    const pool = res.data;

    // Debug: Log raw response from CoinGecko
    console.log(`[Pool Detail] ${poolAddress}:`, JSON.stringify({
        name: pool.attributes.name,
        price_change_percentage: pool.attributes.price_change_percentage,
    }));

    // Build token lookup from included data
    const tokenLookup: Record<string, { name: string; symbol: string; address: string }> = {};
    if (res.included) {
        for (const token of res.included) {
            if (token.type === "token") {
                tokenLookup[token.id] = {
                    name: token.attributes.name,
                    symbol: token.attributes.symbol,
                    address: token.attributes.address,
                };
            }
        }
    }

    const baseTokenId = pool.relationships?.base_token?.data?.id || "";
    const quoteTokenId = pool.relationships?.quote_token?.data?.id || "";
    const baseToken = tokenLookup[baseTokenId];
    const quoteToken = tokenLookup[quoteTokenId];

    return {
        id: pool.id,
        name: pool.attributes.name,
        address: pool.attributes.address,
        dex: pool.relationships?.dex?.data?.id || "unknown",
        baseTokenSymbol: baseToken?.symbol || "???",
        baseTokenAddress: baseToken?.address || "",
        quoteTokenSymbol: quoteToken?.symbol || "???",
        quoteTokenAddress: quoteToken?.address || "",
        // Use base token price for memecoin pools
        priceUsd: pool.attributes.base_token_price_usd || "0",
        reserveInUsd: pool.attributes.reserve_in_usd || "0",
        // Note: fdv_usd and market_cap_usd from CoinGecko are for QUOTE token (SOL), not base token
        fdvUsd: pool.attributes.fdv_usd || "0",
        marketCapUsd: pool.attributes.market_cap_usd || "0",
        volumeUsd: {
            m30: pool.attributes.volume_usd?.m30 || "0",
            h1: pool.attributes.volume_usd?.h1 || "0",
            h6: pool.attributes.volume_usd?.h6 || "0",
            h24: pool.attributes.volume_usd?.h24 || "0",
        },
        // Note: price_change_percentage from CoinGecko is for QUOTE token (SOL), not base token
        priceChangePercentage: {
            m30: pool.attributes.price_change_percentage?.m30 || "0",
            h1: pool.attributes.price_change_percentage?.h1 || "0",
            h6: pool.attributes.price_change_percentage?.h6 || "0",
            h24: pool.attributes.price_change_percentage?.h24 || "0",
        },
        transactions: {
            h24: pool.attributes.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 },
        },
        poolCreatedAt: pool.attributes.pool_created_at || "",
    };
}

export async function getPoolTrades(poolAddress: string, limit: number = 50): Promise<Trade[]> {
    const cgEndpoint = cg.getOnchainEndpoint(`/networks/solana/pools/${poolAddress}/trades`);

    const req = new Request(cgEndpoint, {
        method: "GET",
        headers: cg.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        console.error(`Failed to fetch pool trades: ${resp.status}`);
        return [];
    }

    const res: CG_TradesResponse = await resp.json();

    return res.data.slice(0, limit).map((trade) => ({
        id: trade.id,
        blockTimestamp: trade.attributes.block_timestamp,
        kind: trade.attributes.kind,
        volumeInUsd: trade.attributes.volume_in_usd,
        priceFromInUsd: trade.attributes.price_from_in_usd || "0",
        priceToInUsd: trade.attributes.price_to_in_usd || "0",
        fromTokenAmount: trade.attributes.from_token_amount,
        toTokenAmount: trade.attributes.to_token_amount,
        fromTokenAddress: trade.attributes.from_token_address || "",
        toTokenAddress: trade.attributes.to_token_address || "",
        txFromAddress: trade.attributes.tx_from_address,
        txHash: trade.attributes.tx_hash,
    }));
}
