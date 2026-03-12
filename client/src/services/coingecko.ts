/**
 * CoinGecko API Service
 * Fetch cryptocurrency market data
 */

export interface TokenMarketData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    currentPrice: number;
    marketCap: number;
    marketCapRank: number;
    fdv: number | null;
    totalVolume: number;
    high24h: number;
    low24h: number;
    priceChange24h: number;
    priceChangePercentage1h: number | null;
    priceChangePercentage24h: number;
    priceChangePercentage7d: number | null;
    circulatingSupply: number;
    totalSupply: number;
    maxSupply: number | null;
    ath: number;
    athChangePercentage: number;
    athDate: string;
    atl: number;
    atlChangePercentage: number;
    atlDate: string;
    lastUpdated: string;
}

export interface TrendingToken {
    id: string;
    name: string;
    symbol: string;
    thumb: string;
    priceChangePercentage24h: number;
}

// Onchain Token Data - Aggregated from all pools (like BirdEye)
export interface OnchainTokenData {
    name: string;
    symbol: string;
    address: string;
    priceUsd: number;
    marketCapUsd: number;
    fdvUsd: number;
    totalSupply: number;
    // Volume aggregated from all pools
    volume5m: number;
    volume1h: number;
    volume24h: number;
    // Price changes
    priceChange5m: number;
    priceChange1h: number;
    priceChange24h: number;
    // Transactions (from top pool)
    totalTxn24h: number;
    buyTxn24h: number;
    sellTxn24h: number;
    uniqueBuyers24h: number;
    uniqueSellers24h: number;
    // Pool volume (from top pool)
    poolVolume24h: number;
    // Total liquidity from all pools
    totalLiquidityUsd: number;
    // Top pools info
    topPools: Array<{
        name: string;
        address: string;
        volume24h: number;
        reserve: number;
    }>;
}

// CoinGecko Trending API response types
export interface CoinItem {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    thumb: string;
    small: string;
    large: string;
    slug: string;
    price_btc: number;
    score: number;
    data: {
        price: string | number;
        price_btc: string | number;
        price_change_percentage_24h: {
            usd: number;
        };
        sparkline: string;
    };
}

export interface TrendingResponse {
    coins: { item: CoinItem }[];
}

// CoinGecko GeckoTerminal pool data
export interface CGPoolData {
    id: string;
    attributes: {
        address: string;
        name: string;
        base_token_price_usd: string;
        price_change_percentage: { h24: string };
        volume_usd: { h24: string };
        reserve_in_usd: string;
        transactions: { h24: { buys: number; sells: number } };
    };
    relationships: {
        dex: { data: { id: string } };
    };
}

const BASE_URL = import.meta.env.VITE_COINGECKO_BASE_URL;
const API_KEY = import.meta.env.VITE_COINGECKO_API_KEY;

// Common headers with API key
const getHeaders = () => ({
    accept: "application/json",
    "x-cg-demo-api-key": API_KEY,
});

/**
 * General-purpose authenticated CoinGecko fetch.
 * Returns parsed JSON or null on HTTP error.
 */
export async function cgFetch(path: string): Promise<unknown> {
    const response = await fetch(`${BASE_URL}${path}`, { headers: getHeaders() });
    if (!response.ok) return null;
    return response.json();
}

/**
 * Fetch single token market data
 */
export async function fetchTokenMarketData(
    coinId: string = "solana"
): Promise<TokenMarketData> {
    const params = new URLSearchParams({
        vs_currency: "usd",
        ids: coinId,
        price_change_percentage: "1h,24h,7d",
    });

    const response = await fetch(`${BASE_URL}/coins/markets?${params}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const token = data[0];

    return {
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        image: token.image,
        currentPrice: token.current_price,
        marketCap: token.market_cap,
        marketCapRank: token.market_cap_rank,
        fdv: token.fully_diluted_valuation,
        totalVolume: token.total_volume,
        high24h: token.high_24h,
        low24h: token.low_24h,
        priceChange24h: token.price_change_24h,
        priceChangePercentage1h: token.price_change_percentage_1h_in_currency,
        priceChangePercentage24h: token.price_change_percentage_24h,
        priceChangePercentage7d: token.price_change_percentage_7d_in_currency,
        circulatingSupply: token.circulating_supply,
        totalSupply: token.total_supply,
        maxSupply: token.max_supply,
        ath: token.ath,
        athChangePercentage: token.ath_change_percentage,
        athDate: token.ath_date,
        atl: token.atl,
        atlChangePercentage: token.atl_change_percentage,
        atlDate: token.atl_date,
        lastUpdated: token.last_updated,
    };
}

/**
 * Fetch multiple tokens market data
 */
export async function fetchMultipleTokens(
    coinIds: string[] = ["solana", "bitcoin", "ethereum", "cardano", "dogecoin"]
): Promise<TokenMarketData[]> {
    const params = new URLSearchParams({
        vs_currency: "usd",
        ids: coinIds.join(","),
        price_change_percentage: "1h,24h,7d",
        order: "market_cap_desc",
    });

    const response = await fetch(`${BASE_URL}/coins/markets?${params}`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return data.map((token: Record<string, unknown>) => ({
        id: token.id,
        symbol: token.symbol,
        name: token.name,
        image: token.image,
        currentPrice: token.current_price,
        marketCap: token.market_cap,
        marketCapRank: token.market_cap_rank,
        fdv: token.fully_diluted_valuation,
        totalVolume: token.total_volume,
        high24h: token.high_24h,
        low24h: token.low_24h,
        priceChange24h: token.price_change_24h,
        priceChangePercentage1h: token.price_change_percentage_1h_in_currency,
        priceChangePercentage24h: token.price_change_percentage_24h,
        priceChangePercentage7d: token.price_change_percentage_7d_in_currency,
        circulatingSupply: token.circulating_supply,
        totalSupply: token.total_supply,
        maxSupply: token.max_supply,
        ath: token.ath,
        athChangePercentage: token.ath_change_percentage,
        athDate: token.ath_date,
        atl: token.atl,
        atlChangePercentage: token.atl_change_percentage,
        atlDate: token.atl_date,
        lastUpdated: token.last_updated,
    }));
}

interface TrendingCoinItem {
    item: {
        id: string;
        name: string;
        symbol: string;
        thumb: string;
        data?: {
            price_change_percentage_24h?: {
                usd?: number;
            };
        };
    };
}

/**
 * Fetch trending tokens
 */
export async function fetchTrendingTokens(): Promise<TrendingToken[]> {
    const response = await fetch(`${BASE_URL}/search/trending`, {
        headers: getHeaders(),
    });

    if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return data.coins.slice(0, 10).map((item: TrendingCoinItem) => ({
        id: item.item.id,
        name: item.item.name,
        symbol: item.item.symbol,
        thumb: item.item.thumb,
        priceChangePercentage24h: item.item.data?.price_change_percentage_24h?.usd || 0,
    }));
}

// SOL Token Address on Solana
const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";

/**
 * Fetch onchain token data - Aggregated from all pools (like BirdEye)
 * Uses Token API instead of Pool API
 */
export async function fetchOnchainTokenData(
    network: string = "solana",
    tokenAddress: string = SOL_TOKEN_ADDRESS
): Promise<OnchainTokenData | null> {
    try {
        const url = `${BASE_URL}/onchain/networks/${network}/tokens/${tokenAddress}`;

        const response = await fetch(`${url}?include=top_pools`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.error(`Token API error: ${response.status}`);
            return null;
        }

        const json = await response.json();
        const token = json.data?.attributes;

        if (!token) return null;

        const volumeUsd = token.volume_usd || {};
        const priceChange = token.price_change_percentage || {};

        // Get top pool data from included array (has transactions breakdown)
        const topPool = json.included?.[0]?.attributes || {};
        const poolTxs24h = topPool.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };
        const poolVolume = topPool.volume_usd || {};

        // Parse top pools from included data
        const topPools = (json.included || []).slice(0, 5).map((pool: { attributes: Record<string, unknown> }) => ({
            name: pool.attributes.name || "Unknown",
            address: pool.attributes.address || "",
            volume24h: parseFloat((pool.attributes.volume_usd as Record<string, string>)?.h24 || "0"),
            reserve: parseFloat(pool.attributes.reserve_in_usd as string || "0"),
            priceQuoteToken: parseFloat(pool.attributes.base_token_price_quote_token as string || "0"),
        }));

        return {
            name: token.name || "Unknown",
            symbol: token.symbol || "",
            address: token.address || tokenAddress,
            priceUsd: parseFloat(token.price_usd || "0"),
            marketCapUsd: parseFloat(token.market_cap_usd || "0"),
            fdvUsd: parseFloat(token.fdv_usd || "0"),
            totalSupply: parseFloat(token.normalized_total_supply || token.total_supply || "0"),
            // Volume from token (aggregated from all pools)
            volume5m: parseFloat(volumeUsd.m5 || "0"),
            volume1h: parseFloat(volumeUsd.h1 || "0"),
            volume24h: parseFloat(volumeUsd.h24 || "0"),
            // Price changes from top pool (more detailed)
            priceChange5m: parseFloat(topPool.price_change_percentage?.m5 || priceChange.m5 || "0"),
            priceChange1h: parseFloat(topPool.price_change_percentage?.h1 || priceChange.h1 || "0"),
            priceChange24h: parseFloat(topPool.price_change_percentage?.h24 || priceChange.h24 || "0"),
            // Transactions from TOP POOL (not token - token doesn't have this)
            totalTxn24h: (poolTxs24h.buys || 0) + (poolTxs24h.sells || 0),
            buyTxn24h: poolTxs24h.buys || 0,
            sellTxn24h: poolTxs24h.sells || 0,
            uniqueBuyers24h: poolTxs24h.buyers || 0,
            uniqueSellers24h: poolTxs24h.sellers || 0,
            // Pool volume breakdown (from top pool)
            poolVolume24h: parseFloat(poolVolume.h24 || "0"),
            // Total liquidity from all pools
            totalLiquidityUsd: parseFloat(token.total_reserve_in_usd || "0"),
            // Top pools
            topPools,
        };
    } catch (error) {
        console.error("Error fetching onchain token data:", error);
        return null;
    }
}

/**
 * Search for top pools of a token
 */
export async function fetchTopPools(
    query: string = "SOL",
    network: string = "solana"
): Promise<Array<{ name: string; address: string; volume24h: number; reserve: number }>> {
    try {
        const url = `${BASE_URL}/onchain/search/pools`;
        const params = new URLSearchParams({ query, network });

        const response = await fetch(`${url}?${params}`, {
            headers: getHeaders(),
        });

        if (!response.ok) return [];

        const json = await response.json();
        const pools = json.data || [];

        return pools.slice(0, 5).map((pool: { attributes: Record<string, unknown> }) => ({
            name: pool.attributes.name || "Unknown",
            address: pool.attributes.address || "",
            volume24h: parseFloat((pool.attributes.volume_usd as Record<string, string>)?.h24 || "0"),
            reserve: parseFloat(pool.attributes.reserve_in_usd as string || "0"),
        }));
    } catch (error) {
        console.error("Error fetching top pools:", error);
        return [];
    }
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price: number): string {
    if (price >= 1000) {
        return price.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    } else if (price >= 1) {
        return price.toFixed(2);
    } else {
        return price.toFixed(6);
    }
}

/**
 * Format large numbers (millions, billions)
 */
export function formatLargeNumber(num: number): string {
    if (num >= 1e12) {
        return `$${(num / 1e12).toFixed(2)}T`;
    } else if (num >= 1e9) {
        return `$${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
        return `$${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
        return `$${(num / 1e3).toFixed(2)}K`;
    }
    return `$${num.toFixed(2)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | null): string {
    if (value === null || value === undefined) return "N/A";
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
}

/**
 * Fetch top 20 pools for a specific token address
 * Uses the /onchain/networks/{network}/tokens/{address}/pools endpoint
 */
import type { PoolData } from "../hooks/useTokenPageData";

export async function fetchTokenPools(
    tokenAddress: string,
    network: string = "solana",
    limit: number = 20
): Promise<PoolData[]> {
    try {
        const url = `${BASE_URL}/onchain/networks/${network}/tokens/${tokenAddress}/pools`;
        const params = new URLSearchParams({
            include: "base_token,dex", // Added dex to include
            sort: "h24_volume_usd_desc",
        });

        const response = await fetch(`${url}?${params}`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.error(`Token Pools API error: ${response.status}`);
            return [];
        }

        const json = await response.json();
        const pools = json.data || [];
        const included = json.included || [];

        // GeckoTerminal API Types
        interface TransactionStats {
            buys: number;
            sells: number;
            buyers: number;
            sellers: number;
        }

        interface GeckoTerminalPoolAttributes {
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
            quote_token_price_base_token: string | null;
            price_change_percentage: Record<string, string>;
            transactions: {
                m5: TransactionStats;
                m15: TransactionStats;
                m30: TransactionStats;
                h1: TransactionStats;
                h6: TransactionStats;
                h24: TransactionStats;
            };
        }

        // ... inside fetchTokenPools ...
        return pools.slice(0, limit).map((pool: { attributes: GeckoTerminalPoolAttributes, relationships: Record<string, any> }) => {
            // Determine if our token is the quote token in this pool
            const quoteTokenId = pool.relationships?.quote_token?.data?.id as string;
            // GeckoTerminal IDs are like "solana_<address>" or just "<address>"?
            // Usually network_address. Let's check if it ends with our address
            const isQuote = quoteTokenId && quoteTokenId.endsWith(tokenAddress);

            const attrs = pool.attributes;
            const h24Txns = attrs.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };

            // Get DEX ID from relationships
            const dexRes = pool.relationships?.dex?.data;
            const dexId = dexRes?.id;

            // Find DEX name in included data
            let source = dexId || "unknown";

            if (dexId) {
                const foundDex = included.find((item: any) => item.type === "dex" && item.id === dexId);
                if (foundDex?.attributes?.name) {
                    source = foundDex.attributes.name;
                } else {
                    // Fallback to ID if name not found in included (e.g. "uniswap_v3")
                    // The UI formatter will handle capitalization
                    source = dexId;
                }
            }

            return {
                name: attrs.name || "Unknown Pool",
                address: attrs.address || "",
                source: source,
                volume24h: parseFloat(attrs.volume_usd?.h24 || "0"),
                volumeBuy24h: parseFloat(attrs.buy_volume_usd?.h24 || "0"),
                volumeSell24h: parseFloat(attrs.sell_volume_usd?.h24 || "0"),
                volumeNet24h: parseFloat(attrs.net_buy_volume_usd?.h24 || "0"),
                reserve: parseFloat(attrs.reserve_in_usd || "0"),
                liquidity: parseFloat(attrs.reserve_in_usd || "0"),
                marketCap: parseFloat(attrs.market_cap_usd || "0"),
                fdv: parseFloat(attrs.fdv_usd || "0"),
                priceUsd: parseFloat(((isQuote ? attrs.quote_token_price_usd : attrs.base_token_price_usd) || "0")),
                priceQuoteToken: parseFloat(attrs.base_token_price_quote_token || "0"), // Map it here for list
                priceChange: {
                    m5: parseFloat(attrs.price_change_percentage?.m5 || "0"),
                    h1: parseFloat(attrs.price_change_percentage?.h1 || "0"),
                    h6: parseFloat(attrs.price_change_percentage?.h6 || "0"),
                    h24: parseFloat(attrs.price_change_percentage?.h24 || "0"),
                },
                txns24h: (h24Txns.buys || 0) + (h24Txns.sells || 0),
                buys24h: h24Txns.buys || 0,
                sells24h: h24Txns.sells || 0,
                traders24h: (h24Txns.buyers || 0) + (h24Txns.sellers || 0),
                buyers24h: h24Txns.buyers || 0,
                sellers24h: h24Txns.sellers || 0,
            };
        });
    } catch (error) {
        console.error("Error fetching token pools:", error);
        return [];
    }
}

/**
 * Fetch detailed data for a specific pool
 * Uses the /onchain/networks/{network}/pools/{poolAddress} endpoint
 */
export async function fetchPoolDetails(
    poolAddress: string,
    network: string = "solana"
): Promise<PoolData | null> {
    try {
        const url = `${BASE_URL}/onchain/networks/${network}/pools/${poolAddress}`;
        const params = new URLSearchParams({
            include: "base_token,quote_token,dex",
            include_volume_breakdown: "true",
            x_cg_demo_api_key: API_KEY, // Pass key in params to avoid CORS/header issues
            _t: Date.now().toString(),
        });

        const response = await fetch(`${url}?${params}`, {
            headers: {
                accept: "application/json",
            },
        });

        if (!response.ok) {
            console.error(`Pool Details API error: ${response.status}`);
            return null;
        }

        const json = await response.json();
        const pool = json.data;
        if (!pool) return null;

        const attrs = pool.attributes;
        const h24Txns = attrs.transactions?.h24 || { buys: 0, sells: 0, buyers: 0, sellers: 0 };

        // Parse included data to find quote token symbol
        let quoteTokenSymbol = "SOL"; // Default
        const quoteTokenId = pool.relationships?.quote_token?.data?.id;
        if (quoteTokenId && json.included) {
            const found = json.included.find((item: any) => item.type === "token" && item.id === quoteTokenId);
            if (found && found.attributes?.symbol) {
                quoteTokenSymbol = found.attributes.symbol;
            }
        }

        const result: PoolData = {
            name: attrs.name || "Unknown Pool",
            address: attrs.address || "",
            source: json.included?.find((item: any) => item.type === "dex")?.attributes?.name || "unknown",
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
            quoteToken: {
                symbol: quoteTokenSymbol
            },
            priceChange: {
                m5: parseFloat(attrs.price_change_percentage?.m5 || "0"),
                h1: parseFloat(attrs.price_change_percentage?.h1 || "0"),
                h6: parseFloat(attrs.price_change_percentage?.h6 || "0"),
                h24: parseFloat(attrs.price_change_percentage?.h24 || "0"),
            },
            txns24h: (h24Txns.buys || 0) + (h24Txns.sells || 0),
            buys24h: h24Txns.buys || 0,
            sells24h: h24Txns.sells || 0,
            traders24h: (h24Txns.buyers || 0) + (h24Txns.sellers || 0),
            buyers24h: h24Txns.buyers || 0,
            sellers24h: h24Txns.sellers || 0,
        };

        console.log("[fetchPoolDetails] Parsed Result:", {
            volume24h: result.volume24h,
            volumeBuy24h: result.volumeBuy24h,
            volumeSell24h: result.volumeSell24h,
            volumeNet24h: result.volumeNet24h,
            priceQuoteToken: result.priceQuoteToken,
        });

        return result;
    } catch (error) {
        console.error("Error fetching pool details:", error);
        return null;
    }
}

/**
 * Fetch token holders info (count + top 10%)
 * Uses /onchain/networks/{network}/tokens/{address}/info
 */
export async function fetchTokenHoldersInfo(
    tokenAddress: string,
    network: string = "solana"
): Promise<{ holders_count: number; top_10_percent: number } | null> {
    try {
        const url = `${BASE_URL}/onchain/networks/${network}/tokens/${tokenAddress}/info`;
        const response = await fetch(url, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.error(`Token Info API error: ${response.status}`);
            return null;
        }

        const json = await response.json();
        // Handle various response structures for robust parsing
        const data = json.data;
        // Sometimes it's directly in 'holders' or 'attributes.holders'
        const holders = data?.attributes?.holders || json.holders;

        if (holders) {
            return {
                holders_count: Number(holders.count || 0),
                top_10_percent: Number(holders.distribution_percentage?.top_10 || 0),
            };
        }

        return null;

    } catch (error) {
        console.error("Error fetching token holders info:", error);
        return null; // Return null on error
    }
}

/**
 * Fetch recent trades for a specific pool
 * Uses /onchain/networks/{network}/pools/{pool_address}/trades
 */
export interface PoolTrade {
    id: string;
    type: "buy" | "sell";
    priceUsd: string;
    priceQuote: string; // Price in quote token (e.g. SOL)
    volumeUsd: string;
    amount: string; // Token amount
    fromAddress: string;
    timestamp: string;
    txHash: string;
    baseTokenAmount: string; // For Buy: Output, For Sell: Input
    quoteTokenAmount: string; // For Buy: Input, For Sell: Output
    kind: "buy" | "sell";
}

export async function fetchPoolTrades(
    poolAddress: string,
    network: string = "solana"
): Promise<PoolTrade[]> {
    try {
        const url = `${BASE_URL}/onchain/networks/${network}/pools/${poolAddress}/trades`;
        const params = new URLSearchParams({
            "x-cg-demo-api-key": API_KEY,
        });

        const response = await fetch(`${url}?${params}`, {
            headers: getHeaders(),
        });

        if (!response.ok) {
            console.error(`Pool Trades API error: ${response.status}`);
            return [];
        }

        const json = await response.json();
        const data = json.data || [];

        return data.map((item: any) => {
            const attr = item.attributes;

            // Determine type (kind is 'buy' or 'sell')
            const kind = attr.kind || "buy";

            // Parse common fields
            // Coingecko returns price_to_in_usd for BUY (destination token price)
            // For SELL, it's price_from_in_usd (source token price)
            const priceUsd = kind === "buy" ? attr.price_to_in_usd : attr.price_from_in_usd;

            // Price in quote (e.g. SOL).
            // Usually price_to_in_currency_token (for BUY) or price_from_in_currency_token (for SELL)
            const priceQuote = kind === "buy" ? attr.price_to_in_currency_token : attr.price_from_in_currency_token;

            // Amount of the main token being swapped
            // Buy: to_token_amount
            // Sell: from_token_amount
            const amount = kind === "buy" ? attr.to_token_amount : attr.from_token_amount;

            return {
                id: item.id,
                type: kind,
                kind: kind,
                priceUsd: priceUsd || "0",
                priceQuote: priceQuote || "0",
                volumeUsd: attr.volume_in_usd || "0",
                amount: amount || "0",
                fromAddress: attr.tx_from_address || "",
                timestamp: attr.block_timestamp,
                txHash: attr.tx_hash,
                baseTokenAmount: attr.to_token_amount,
                quoteTokenAmount: attr.from_token_amount,
            };
        });

    } catch (error) {
        console.error("Error fetching pool trades:", error);
        return [];
    }
}
