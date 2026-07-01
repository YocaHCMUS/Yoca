import { normalizedWalletEventSchema } from "../schemas/normalizedWalletEvent.schema";
import { normalizeHeliusTransactions } from "../normalizers/normalizeHeliusTransactions";
import type { HeliusEnhancedTransactionLike } from "../types/normalizedWalletEvent";

export const MOCK_WALLET_ADDRESS = "9xMockWallet1111111111111111111111111111111111111";

export const MOCK_HELIUS_SWAP_TRANSACTION: HeliusEnhancedTransactionLike = {
    signature: "5SwapMock11111111111111111111111111111111111111111111111111111",
    slot: 123456789,
    timestamp: 1716400000,
    type: "SWAP",
    source: "JUPITER",
    description: "Swap USDC for SOL",
    fee: 5000,
    feePayer: MOCK_WALLET_ADDRESS,
    tokenTransfers: [
        {
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenAmount: 100,
            fromUserAccount: MOCK_WALLET_ADDRESS,
            toUserAccount: "pool-usdc",
            symbol: "USDC",
            tokenName: "USD Coin",
        },
        {
            mint: "So11111111111111111111111111111111111111112",
            tokenAmount: 0.62,
            fromUserAccount: "pool-sol",
            toUserAccount: MOCK_WALLET_ADDRESS,
            symbol: "SOL",
            tokenName: "Solana",
        },
    ],
    nativeTransfers: [],
    events: {
        swap: {
            source: "JUPITER",
            tokenInputs: [
                {
                    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    rawTokenAmount: { tokenAmount: "100000000", decimals: 6 },
                },
            ],
            tokenOutputs: [
                {
                    mint: "So11111111111111111111111111111111111111112",
                    rawTokenAmount: { tokenAmount: "620000000", decimals: 9 },
                },
            ],
        },
    },
};

export const MOCK_TOKEN_TRANSFER_TRANSACTION: HeliusEnhancedTransactionLike = {
    signature: "5TokenMock1111111111111111111111111111111111111111111111111111",
    slot: 123456790,
    timestamp: 1716400100,
    type: "TRANSFER",
    source: "SYSTEM_PROGRAM",
    description: "Token transfer",
    fee: 5000,
    feePayer: MOCK_WALLET_ADDRESS,
    tokenTransfers: [
        {
            mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
            tokenAmount: 25,
            fromUserAccount: MOCK_WALLET_ADDRESS,
            toUserAccount: "friend-wallet",
            symbol: "USDC",
            tokenName: "USD Coin",
        },
    ],
    nativeTransfers: [],
};

export const MOCK_NATIVE_TRANSFER_TRANSACTION: HeliusEnhancedTransactionLike = {
    signature: "5NativeMock11111111111111111111111111111111111111111111111111",
    slot: 123456791,
    timestamp: 1716400200,
    type: "TRANSFER",
    source: "SYSTEM_PROGRAM",
    description: "SOL transfer",
    fee: 5000,
    feePayer: MOCK_WALLET_ADDRESS,
    nativeTransfers: [
        {
            amount: 1_500_000_000,
            fromUserAccount: MOCK_WALLET_ADDRESS,
            toUserAccount: "friend-wallet",
        },
    ],
    tokenTransfers: [],
};

export const MOCK_NORMALIZED_WALLET_EVENTS = normalizeHeliusTransactions({
    walletAddress: MOCK_WALLET_ADDRESS,
    transactions: [
        MOCK_HELIUS_SWAP_TRANSACTION,
        MOCK_TOKEN_TRANSFER_TRANSACTION,
        MOCK_NATIVE_TRANSFER_TRANSACTION,
    ],
    parserVersion: "fixture-1.0.0",
});

export const MOCK_NORMALIZED_WALLET_EVENTS_VALIDATED = MOCK_NORMALIZED_WALLET_EVENTS.map((event) =>
    normalizedWalletEventSchema.parse(event),
);