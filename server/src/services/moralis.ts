// server/src/services/moralis.ts

const MORALIS_API_URL = "https://solana-gateway.moralis.io";
// Note: In a real production app, this should be in an environment variable.
const API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjM3ZGExMjYwLWZhODctNDFmYi1iZTI4LWNkNmFhNTg5Y2UzOCIsIm9yZ0lkIjoiNDkwMjQ3IiwidXNlcklkIjoiNTA0Mzk5IiwidHlwZUlkIjoiOWQ5MGNhZTctNTgzNy00OWZlLWEzMzMtMzFhODdmNjdkNGMzIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NjgzMTExOTYsImV4cCI6NDkyNDA3MTE5Nn0.1cf115zwI2EYtdd5vaW7g2xM2JS0JCxSN5dRIRxp6NA";

export interface TopHolder {
    ownerAddress: string;
    balance: string;
    balanceFormatted: string;
    percentageOfSupply: number;
    usdValue: number;
}

/**
 * Fetch top holders for a token on Solana via Moralis API
 */
export async function getTopHolders(
    tokenAddress: string,
    limit: number = 10
): Promise<TopHolder[]> {
    try {
        const url = `${MORALIS_API_URL}/token/mainnet/${tokenAddress}/top-holders?limit=${limit}`;

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "X-API-Key": API_KEY,
            },
        });

        if (!response.ok) {
            console.error(`Moralis API error: ${response.status} - ${response.statusText}`);
            return [];
        }

        const data = await response.json();
        const results = data.result || []; // Access the 'result' property

        // Map the response to our interface
        return results.map((holder: Record<string, unknown>) => ({
            ownerAddress: (holder.ownerAddress || holder.owner_address) as string || "",
            balance: (holder.balance || holder.amount) as string || "0",
            balanceFormatted: (holder.balanceFormatted || holder.amount_formatted) as string || "0",
            percentageOfSupply: Number(holder.percentageRelativeToTotalSupply ?? holder.percentage_of_total_supply ?? 0),
            usdValue: Number(holder.usdValue ?? 0),
        }));
    } catch (error) {
        console.error("Error fetching top holders from Moralis:", error);
        return [];
    }
}
