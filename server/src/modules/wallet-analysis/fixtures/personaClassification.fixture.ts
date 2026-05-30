import { WalletBehaviorProfileSchema } from "../schemas/walletBehaviorProfile.schema";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import { buildWalletBehaviorProfile } from "../analyzers/buildWalletBehaviorProfile";
import { enrichProfileWithPersona } from "../analyzers/enrichProfileWithPersona";

const WALLET_ADDRESS = "9xPersonaFixtureWallet111111111111111111111111111";

function makeSwapEvent(index: number): NormalizedWalletEvent {
    const isBuy = index % 2 === 0;
    const inputMint = isBuy
        ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
        : `TokenMint${index}`;
    const outputMint = isBuy
        ? `TokenMint${index}`
        : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

    return {
        id: `sig-${index}:${WALLET_ADDRESS}`,
        walletAddress: WALLET_ADDRESS,
        signature: `sig-${index}`,
        slot: index,
        timestamp: new Date(Date.UTC(2026, 4, 1, 0, index)).toISOString(),
        status: "SUCCESS",
        type: "SWAP",
        direction: "BOTH",
        protocol: { name: "Jupiter", category: "DEX", programId: null },
        nativeTransfers: [],
        tokenTransfers: [],
        swap: {
            inputMint,
            outputMint,
            inputSymbol: isBuy ? "USDC" : `T${index}`,
            outputSymbol: isBuy ? `T${index}` : "USDC",
            inputAmount: isBuy ? 100 : 1,
            outputAmount: isBuy ? 1 : 100,
            inputValueUsd: isBuy ? 100 : null,
            outputValueUsd: isBuy ? null : 100,
            estimatedSwapValueUsd: 100,
            route: ["Jupiter"],
            dex: "Jupiter",
            tradeDirectionForWallet: isBuy ? "BUY" : "SELL",
        },
        nftEvent: null,
        fee: null,
        summary: `Swap ${index}`,
        rawSource: { provider: "HELIUS", parserVersion: "fixture-1.0.0" },
        warnings: [],
    };
}

const baseProfile = buildWalletBehaviorProfile({
    walletAddress: WALLET_ADDRESS,
    events: Array.from({ length: 80 }, (_, index) => makeSwapEvent(index + 1)),
    schemaVersion: "1.0.0",
    analysisVersion: "fixture-1.0.0",
});

baseProfile.trading = {
    ...baseProfile.trading,
    uniqueTokensTraded: 25,
    shortTermTradeRatio: 0.65,
    totalVolumeUsd: 500,
    averageTradeSizeUsd: 100,
    medianTradeSizeUsd: 100,
    tradingStyle: "ACTIVE_TRADER",
};

baseProfile.protocolUsage = {
    ...baseProfile.protocolUsage,
    dexUsageRatio: 0.9,
};

baseProfile.pnl = {
    ...baseProfile.pnl,
    realizedPnlUsd: -126.4,
    totalPnlUsd: -126.4,
    closedPositionCount: 20,
    winRate: 0.4,
    profitFactor: 0.9,
    pnlStatus: "UNPROFITABLE",
    calculationMethod: "FIFO",
    limitations: baseProfile.pnl.limitations,
};

export const PERSONA_CLASSIFICATION_FIXTURE_PROFILE = enrichProfileWithPersona({
    profile: baseProfile,
    events: Array.from({ length: 80 }, (_, index) => makeSwapEvent(index + 1)),
});

export const PERSONA_CLASSIFICATION_FIXTURE_VALIDATED = WalletBehaviorProfileSchema.parse(PERSONA_CLASSIFICATION_FIXTURE_PROFILE);