export type NormalizedWalletEvent = {
    id: string;
    walletAddress: string;
    signature: string;
    slot?: number | null;
    timestamp: string;
    status: "SUCCESS" | "FAILED" | "UNKNOWN";
    type: WalletEventType;
    direction: WalletEventDirection;
    protocol?: ProtocolInfo | null;
    nativeTransfers: NormalizedNativeTransfer[];
    tokenTransfers: NormalizedTokenTransfer[];
    swap?: NormalizedSwap | null;
    nftEvent?: NormalizedNftEvent | null;
    fee?: TransactionFeeInfo | null;
    summary: string;
    rawSource: {
        provider: "HELIUS" | "JUPITER" | "CUSTOM";
        parserVersion: string;
    };
    warnings: string[];
};

export type WalletEventType =
    | "SWAP"
    | "TOKEN_TRANSFER_IN"
    | "TOKEN_TRANSFER_OUT"
    | "NATIVE_TRANSFER_IN"
    | "NATIVE_TRANSFER_OUT"
    | "NFT_TRANSFER_IN"
    | "NFT_TRANSFER_OUT"
    | "NFT_PURCHASE"
    | "NFT_SALE"
    | "STAKE"
    | "UNSTAKE"
    | "AIRDROP_CLAIM"
    | "BRIDGE"
    | "APPROVAL_OR_AUTHORITY_CHANGE"
    | "UNKNOWN";

export type WalletEventDirection = "IN" | "OUT" | "BOTH" | "NEUTRAL" | "UNKNOWN";

export type ProtocolInfo = {
    name: string;
    category: "DEX" | "LENDING" | "NFT_MARKETPLACE" | "STAKING" | "BRIDGE" | "CEX" | "SYSTEM" | "UNKNOWN";
    programId?: string | null;
};

export type NormalizedNativeTransfer = {
    from: string;
    to: string;
    amountSol: number;
    amountLamports: number;
    directionForWallet: "IN" | "OUT" | "NEUTRAL" | "UNKNOWN";
};

export type NormalizedTokenTransfer = {
    mint: string;
    fromUserAccount?: string | null;
    toUserAccount?: string | null;
    fromTokenAccount?: string | null;
    toTokenAccount?: string | null;
    amount: number;
    rawAmount?: string | null;
    decimals?: number | null;
    symbol?: string | null;
    name?: string | null;
    directionForWallet: "IN" | "OUT" | "NEUTRAL" | "UNKNOWN";
    valueUsd?: number | null;
};

export type NormalizedSwap = {
    inputMint: string;
    outputMint: string;
    inputSymbol?: string | null;
    outputSymbol?: string | null;
    inputAmount: number;
    outputAmount: number;
    inputValueUsd?: number | null;
    outputValueUsd?: number | null;
    estimatedSwapValueUsd?: number | null;
    route?: string[] | null;
    dex?: string | null;
    tradeDirectionForWallet: "BUY" | "SELL" | "TOKEN_TO_TOKEN" | "STABLE_TO_TOKEN" | "TOKEN_TO_STABLE" | "UNKNOWN";
};

export type NormalizedNftEvent = {
    mint: string;
    name?: string | null;
    collection?: string | null;
    action: "TRANSFER_IN" | "TRANSFER_OUT" | "PURCHASE" | "SALE" | "LIST" | "DELIST" | "UNKNOWN";
    priceUsd?: number | null;
    marketplace?: string | null;
};

export type TransactionFeeInfo = {
    feeLamports?: number | null;
    feeSol?: number | null;
    priorityFeeLamports?: number | null;
    priorityFeeSol?: number | null;
    payer?: string | null;
};

export type HeliusEnhancedTransactionLike = {
    signature?: string;
    slot?: number;
    timestamp?: number;
    type?: string;
    source?: string;
    description?: string;
    fee?: number;
    feePayer?: string;
    nativeTransfers?: any[];
    tokenTransfers?: any[];
    accountData?: any[];
    events?: {
        swap?: any;
        nft?: any;
        compressed?: any;
    };
    transactionError?: any;
    info?: {
        feePayer?: string;
        fee?: number;
        slot?: number;
        timestamp?: number;
    };
};

export type WalletEventDraft = {
    walletAddress: string;
    signature: string;
    transactionType?: string | null;
    description?: string | null;
    protocol?: ProtocolInfo | null;
    nativeTransfers: NormalizedNativeTransfer[];
    tokenTransfers: NormalizedTokenTransfer[];
    swap?: NormalizedSwap | null;
    nftEvent?: NormalizedNftEvent | null;
    warnings?: string[];
};

export type WalletEventClassification = {
    type: WalletEventType;
    direction: WalletEventDirection;
    warnings: string[];
};