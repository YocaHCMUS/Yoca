// import { TRENDING_TOKENS_TTL_MS } from "@sv/config/constants.js";
// import { trendingTokens, type TrendingTokenInsert } from "@sv/db/schema.js";
// import * as cg from "@sv/util/util-coingecko.js";
import { UPDATE_TOP_TOKENS_BY_MARKET_CAP_TTL_MS } from "@sv/config/constants.js";
import { db } from "@sv/db/index.js";
import { topTokensByMarketCap } from "@sv/db/schema.js";
import * as bds from "@sv/util/util-birdeye.js";
import { asc } from "drizzle-orm";

export type BDS_TopTokensByMarketCap = {
    data: {
        items: Array<{
            address: string
            logo_uri?: string
            name?: string
            symbol?: string
            decimals: number
            extensions?: {
                twitter?: string
                website?: string
                telegram?: string
                description?: string
            }
            market_cap: number
            fdv: number
            total_supply: number
            circulating_supply?: number
            liquidity: number
            last_trade_unix_time: number
            volume_1m_usd?: number
            volume_5m_usd?: number
            volume_30m_usd: number
            volume_1m_change_percent: any
            volume_5m_change_percent: any
            volume_30m_change_percent: any
            volume_1h_usd: number
            volume_1h_change_percent: any
            volume_2h_usd: number
            volume_2h_change_percent: any
            volume_4h_usd: number
            volume_4h_change_percent: any
            volume_8h_usd: number
            volume_8h_change_percent: any
            volume_24h_usd: number
            volume_24h_change_percent?: number
            volume_7d_usd?: number
            volume_7d_change_percent?: number
            volume_30d_usd?: number
            volume_30d_change_percent?: number
            trade_1m_count?: number
            trade_5m_count?: number
            trade_30m_count: number
            trade_1h_count: number
            trade_2h_count: number
            trade_4h_count: number
            trade_8h_count: number
            trade_24h_count: number
            trade_7d_count?: number
            trade_30d_count?: number
            buy_24h: number
            buy_24h_change_percent?: number
            volume_buy_24h_usd: number
            volume_buy_24h_change_percent?: number
            buy_7d?: number
            buy_7d_change_percent?: number
            volume_buy_7d_usd?: number
            volume_buy_7d_change_percent?: number
            buy_30d?: number
            buy_30d_change_percent?: number
            volume_buy_30d_usd?: number
            volume_buy_30d_change_percent?: number
            sell_24h: number
            sell_24h_change_percent?: number
            volume_sell_24h_usd: number
            volume_sell_24h_change_percent?: number
            sell_7d?: number
            sell_7d_change_percent?: number
            volume_sell_7d_usd?: number
            volume_sell_7d_change_percent?: number
            sell_30d?: number
            sell_30d_change_percent?: number
            volume_sell_30d_usd?: number
            volume_sell_30d_change_percent?: number
            unique_wallet_24h: number
            unique_wallet_24h_change_percent?: number
            price: number
            price_change_1m_percent?: number
            price_change_5m_percent?: number
            price_change_30m_percent?: number
            price_change_1h_percent?: number
            price_change_2h_percent?: number
            price_change_4h_percent?: number
            price_change_8h_percent?: number
            price_change_24h_percent?: number
            price_change_7d_percent?: number
            price_change_30d_percent?: number
            holder?: number
            recent_listing_time?: number
            is_scaled_ui_token: boolean
            multiplier: any
        }>
        has_next: boolean
    }
    success: boolean
}


// https://docs.birdeye.so/reference/get-defi-v3-token-list
export async function getTopTokensByMarketCap() {
    const result = await db
        .select()
        .from(topTokensByMarketCap)
        .orderBy(asc(topTokensByMarketCap.rank))

    const thresholdTime = new Date(Date.now() - UPDATE_TOP_TOKENS_BY_MARKET_CAP_TTL_MS);

    if (result.length > 0 && result[0].updatedAt > thresholdTime) {
        return result;
    }

    const bdsEndpoint = bds.getEndpoint("/defi/v3/token/list");

    bdsEndpoint.search = new URLSearchParams({
        sort_by: "market_cap",
        sort_type: "desc",
        limit: "60",
    }).toString();

    const req = new Request(bdsEndpoint, {
        method: "GET",
        headers: bds.getRequiredHeaders(),
    });

    const resp = await fetch(req);

    if (!resp.ok) {
        return null;
    }

    const res: BDS_TopTokensByMarketCap = await resp.json();

    if (!res.success) {
        return null;
    }

    await db.delete(topTokensByMarketCap);
    return await db.insert(topTokensByMarketCap).values(
        res.data.items.map((token, index) => ({
            address: token.address,
            rank: index + 1,
        })),
    ).returning();
}
