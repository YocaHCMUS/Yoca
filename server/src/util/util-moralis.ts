// Moralis API utility functions
const MORALIS_API_BASE_URL = "https://solana-gateway.moralis.io";
const MORALIS_API_KEY = process.env.MORALIS_API_KEY || "";

export function getEndpoint(path: string): URL {
    return new URL(`${MORALIS_API_BASE_URL}${path}`);
}

export function getRequiredHeaders(): HeadersInit {
    return {
        accept: "application/json",
        "X-API-Key": MORALIS_API_KEY,
    };
}

export interface MoralisTopHolder {
    balance: string;
    balanceFormatted: string;
    isContract: boolean;
    ownerAddress: string;
    usdValue: string;
    percentageRelativeToTotalSupply: number;
}

export interface TopHolderInfo {
    rank: number;
    ownerAddress: string;
    percentageHeld: number;
}

export interface TopHoldersResponse {
    holders: TopHolderInfo[];
    totalPercentage: number;
}

// Response wrapper from Moralis API
interface MoralisTopHoldersResponse {
    result?: MoralisTopHolder[];
}

export async function getTopHolders(
    tokenAddress: string,
    limit: number = 10
): Promise<TopHoldersResponse | null> {
    const endpoint = getEndpoint(`/token/mainnet/${tokenAddress}/top-holders`);
    endpoint.searchParams.set("limit", limit.toString());

    const req = new Request(endpoint.toString(), {
        method: "GET",
        headers: getRequiredHeaders(),
    });

    try {
        const resp = await fetch(req);
        if (resp.ok) {
            const responseData = await resp.json();

            // Handle both array response and wrapped response { result: [...] }
            let holdersArray: MoralisTopHolder[];
            if (Array.isArray(responseData)) {
                holdersArray = responseData;
            } else if (responseData.result && Array.isArray(responseData.result)) {
                holdersArray = responseData.result;
            } else {
                console.error("Unexpected Moralis response format:", responseData);
                return null;
            }

            const holders: TopHolderInfo[] = holdersArray.map((holder, index) => ({
                rank: index + 1,
                ownerAddress: holder.ownerAddress,
                percentageHeld: holder.percentageRelativeToTotalSupply,
            }));

            const totalPercentage = holders.reduce(
                (sum, holder) => sum + holder.percentageHeld,
                0
            );

            return {
                holders,
                totalPercentage: Math.round(totalPercentage * 100) / 100, // Round to 2 decimals
            };
        } else {
            console.error(`Moralis API error: ${resp.status} ${resp.statusText}`);
            return null;
        }
    } catch (error) {
        console.error("Failed to fetch top holders from Moralis:", error);
        return null;
    }
}
