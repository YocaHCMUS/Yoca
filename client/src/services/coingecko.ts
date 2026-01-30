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

const BASE_URL = "https://api.coingecko.com/api/v3";
const API_KEY = "CG-MjPFyX8QAo68K93S65PHjrki";

// Common headers with API key
const getHeaders = () => ({
    accept: "application/json",
    "x-cg-demo-api-key": API_KEY,
});

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
