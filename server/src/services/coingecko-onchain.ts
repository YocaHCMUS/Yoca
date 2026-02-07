// server/src/services/coingecko-onchain.ts

const COINGECKO_API_URL = "https://api.coingecko.com/api/v3/onchain";
// Using the demo key provided by the user
const API_KEY = "CG-MjPFyX8QAo68K93S65PHjrki";

export interface TradeAttributes {
    block_number: number;
    block_timestamp: string;
    block_timestamp_unix: number;
    kind: "buy" | "sell";
    price_from_in_currency_token: string;
    price_to_in_currency_token: string;
    price_from_in_usd: string;
    price_to_in_usd: string;
    volume_in_usd: string;
    from_token_amount: string;
    to_token_amount: string;
    tx_hash: string;
    tx_from_address: string;
}

export interface Trade {
    id: string;
    type: "trade";
    attributes: TradeAttributes;
}

export interface TradesResponse {
    data: Trade[];
}

/**
 * Fetch recent trades for a pool on a specific network
 */
export async function getPoolTrades(
    network: string,
    poolAddress: string
): Promise<Trade[]> {
    try {
        const url = `${COINGECKO_API_URL}/networks/${network}/pools/${poolAddress}/trades?token=base`;

        console.log(`Fetching trades from: ${url}`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "x-cg-demo-api-key": API_KEY,
            },
        });

        if (!response.ok) {
            console.error(`CoinGecko Onchain API error: ${response.status} - ${response.statusText}`);
            const text = await response.text();
            console.error(`Error body: ${text}`);
            return [];
        }

        const data = await response.json() as TradesResponse;
        return data.data || [];
    } catch (error) {
        console.error("Error fetching trades from CoinGecko Onchain:", error);
        return [];
    }
}
