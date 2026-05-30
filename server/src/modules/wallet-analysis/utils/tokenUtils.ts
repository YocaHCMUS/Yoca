export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const WSOL_MINT = SOL_MINT;
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4h4H8o3A8rM6jD5M3j6Q";

export const COMMON_STABLECOIN_MINTS = new Set<string>([
    USDC_MINT,
    USDT_MINT,
    "USDSwr9ApdHk5bvJKMjzff41FfuX8bSxdKcR81vTwcA",
    "2b1kV6DkP7d3xERf9jR7WvyaManEXZDV4SSQSSHqzTe",
]);

export const COMMON_SOL_LIKE_IDENTIFIERS = new Set<string>([SOL_MINT, WSOL_MINT, "SOL", "WSOL"]);

function normalizeIdentifier(value: string): string {
    return value.trim();
}

export function isStablecoinMint(mint: string): boolean {
    const normalized = normalizeIdentifier(mint);
    return COMMON_STABLECOIN_MINTS.has(normalized);
}

export function isSolLikeMint(mint: string): boolean {
    const normalized = normalizeIdentifier(mint);
    return COMMON_SOL_LIKE_IDENTIFIERS.has(normalized) || normalized === SOL_MINT;
}

export function inferTradeDirection(
    inputMint: string | null | undefined,
    outputMint: string | null | undefined,
): "BUY" | "SELL" | "TOKEN_TO_TOKEN" | "STABLE_TO_TOKEN" | "TOKEN_TO_STABLE" | "UNKNOWN" {
    const input = normalizeIdentifier(String(inputMint ?? ""));
    const output = normalizeIdentifier(String(outputMint ?? ""));

    if (!input || !output) {
        return "UNKNOWN";
    }

    const inputStable = isStablecoinMint(input);
    const outputStable = isStablecoinMint(output);
    const inputSolLike = isSolLikeMint(input);
    const outputSolLike = isSolLikeMint(output);

    if (!inputStable && !inputSolLike && !outputStable && !outputSolLike) {
        return "TOKEN_TO_TOKEN";
    }

    if ((inputStable || inputSolLike) && !(outputStable || outputSolLike)) {
        return inputSolLike ? "BUY" : "STABLE_TO_TOKEN";
    }

    if (!(inputStable || inputSolLike) && (outputStable || outputSolLike)) {
        return outputSolLike ? "SELL" : "TOKEN_TO_STABLE";
    }

    return "UNKNOWN";
}