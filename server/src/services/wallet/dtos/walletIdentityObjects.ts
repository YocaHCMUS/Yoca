import type { SupportedChain } from "@sv/services/wallet/dtos/walletDataObjects.js";

export type WalletIdentityStatus = "known" | "unknown" | "unavailable";

export interface HeliusWalletIdentityRaw {
    address?: string;
    name?: string;
    category?: string;
    type?: string;
    tags?: string[];
    domainNames?: string[];
    domains?: string[];
    [key: string]: unknown;
}

export type HeliusWalletIdentityBatchRaw = HeliusWalletIdentityRaw[];

export interface WalletIdentityNormalized {
    status: WalletIdentityStatus;
    type: string | null;
    name: string | null;
    category: string | null;
    tags: string[];
    domainNames: string[];
    provider: "helius";
    providerVersion: "wallet-api-beta";
    resolvedAt: string;
}

export interface WalletIdentityCacheMetadata {
    hit: boolean;
    stale: boolean;
    ttlSec: number;
}

export interface WalletIdentityProviderMetadata {
    statusCode?: number;
    errorCode?: string;
}

export interface WalletIdentityResponse {
    address: string;
    chain: SupportedChain;
    identity: WalletIdentityNormalized;
    metadata: {
        cache: WalletIdentityCacheMetadata;
        provider: WalletIdentityProviderMetadata;
    };
}

export interface WalletIdentityBatchResponse {
    chain: SupportedChain;
    results: WalletIdentityResponse[];
}

export interface WalletIdentityAnalysis {
    riskScore: number;
    riskLevel: "low" | "medium" | "high";
    signals: string[];
    counterpartyProfile: {
        exchangeInteractions24h: number;
        uniqueKnownEntities7d: number;
    };
    userTags?: string[];
}

export interface WalletIntelligenceResponse {
    address: string;
    chain: SupportedChain;
    identity: WalletIdentityNormalized;
    analysis: WalletIdentityAnalysis;
    metadata: {
        cache: {
            identityHit: boolean;
            analysisHit: boolean;
            ttlSec: number;
            staleIdentity: boolean;
        };
        provider: WalletIdentityProviderMetadata;
    };
}

export interface WalletIntelligenceBatchResponse {
    chain: SupportedChain;
    results: WalletIntelligenceResponse[];
}
