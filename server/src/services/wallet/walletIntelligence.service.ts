import type {
    WalletFirstFundInsight,
    WalletIdentityAnalysis,
    WalletIdentityResponse,
    WalletIntelligenceBatchResponse,
    WalletIntelligenceResponse,
} from "@sv/services/wallet/dtos/walletIdentityObjects.js";

import { buildWalletFirstFundInsight } from "@sv/services/wallet/walletFirstFundInsight.js";
import { getWalletFirstFund } from "@sv/services/wallet/walletFirstFund.service.js";
import { getWalletOverview } from "@sv/services/wallet/walletOverview.service.js";
import { getWalletTags } from "@sv/services/walletTags.js";
import {
    WalletIdentityServiceError,
    buildUnavailableIdentity,
    getWalletIdentity,
    getWalletIdentityBatch,
} from "@sv/services/wallet/walletIdentity.service.js";

type ComposeWalletIntelligenceOptions = {
    userId?: string;
    includeUserTags?: boolean;
};

type AnalysisInputs = {
    exchangeInteractions24h: number;
    uniqueKnownEntities7d: number;
    transactionCount24h: number;
    analyticsComplete: boolean;
};

function normalizeRiskScore(score: number): number {
    const bounded = Math.max(0, Math.min(100, Math.round(score)));
    return bounded;
}

function toRiskLevel(score: number): "low" | "medium" | "high" {
    if (score < 35) {
        return "low";
    }

    if (score < 70) {
        return "medium";
    }

    return "high";
}

function isRecoverableProviderError(err: unknown): err is WalletIdentityServiceError {
    return (
        err instanceof WalletIdentityServiceError &&
        (
            err.code === "provider_bad_request" ||
            err.code === "provider_unauthorized" ||
            err.code === "provider_rate_limited" ||
            err.code === "provider_unavailable" ||
            err.code === "provider_bad_payload" ||
            err.code === "provider_unknown"
        )
    );
}

function hasRiskyTag(tags: string[]): boolean {
    const riskyKeywords = ["scam", "hack", "rug", "exploit", "phish", "malicious", "fraud"];
    return tags.some((tag) => riskyKeywords.some((keyword) => tag.toLowerCase().includes(keyword)));
}

function hasTrustedTag(tags: string[]): boolean {
    const trustedKeywords = ["verified", "team", "trusted", "internal", "safe"];
    return tags.some((tag) => trustedKeywords.some((keyword) => tag.toLowerCase().includes(keyword)));
}

function buildWalletIdentityAnalysis(input: {
    identity: WalletIdentityResponse["identity"];
    analysisInputs: AnalysisInputs;
    firstFund: WalletFirstFundInsight | null;
    userTags: string[];
}): WalletIdentityAnalysis {
    const signals: string[] = [];
    let riskScore = 50;

    if (input.identity.status === "known") {
        riskScore -= 20;
        signals.push("known_entity");
    }

    if (input.identity.status === "unknown") {
        riskScore += 10;
        signals.push("unknown_entity");
    }

    if (input.identity.status === "unavailable") {
        riskScore += 15;
        signals.push("identity_unavailable");
    }

    const identityCategory = `${input.identity.category ?? ""} ${input.identity.type ?? ""}`.toLowerCase();
    if (identityCategory.includes("exchange")) {
        riskScore -= 10;
        signals.push("exchange_category");
    }

    if (input.analysisInputs.exchangeInteractions24h > 0) {
        signals.push("exchange_interactions_detected");
    }

    if (input.analysisInputs.exchangeInteractions24h >= 20) {
        riskScore += 12;
        signals.push("elevated_exchange_interactions");
    }

    if (input.analysisInputs.uniqueKnownEntities7d >= 8) {
        riskScore += 8;
        signals.push("broad_counterparty_surface");
    }

    if (input.analysisInputs.transactionCount24h >= 100) {
        riskScore += 15;
        signals.push("high_transaction_count_24h");
    } else if (input.analysisInputs.transactionCount24h > 0) {
        signals.push("active_wallet_24h");
    }

    if (hasRiskyTag(input.userTags)) {
        riskScore += 25;
        signals.push("risky_user_tag");
    }

    if (hasTrustedTag(input.userTags)) {
        riskScore -= 8;
        signals.push("trusted_user_tag");
    }

    const uniqueSignals = Array.from(new Set(signals));
    const normalizedRiskScore = normalizeRiskScore(riskScore);

    return {
        riskScore: normalizedRiskScore,
        riskLevel: toRiskLevel(normalizedRiskScore),
        signals: uniqueSignals,
        firstFund: input.firstFund,
        userTags: input.userTags,
    };
}

async function getAnalysisInputs(address: string): Promise<AnalysisInputs> {
    const overviewResult = await getWalletOverview(address)
        .then((overview) => ({ ok: true as const, value: overview }))
        .catch(() => ({ ok: false as const, value: null }));

    const transactionCount24h =
        overviewResult.ok && overviewResult.value?.transactionCount24h != null
            ? Number(overviewResult.value.transactionCount24h)
            : 0;

    return {
        exchangeInteractions24h: 0,
        uniqueKnownEntities7d: 0,
        transactionCount24h,
        analyticsComplete: overviewResult.ok,
    };
}

async function getOptionalUserTags(userId: string | undefined, address: string): Promise<string[]> {
    if (!userId || userId.trim().length === 0) {
        return [];
    }

    try {
        return await getWalletTags(userId, address);
    } catch {
        return [];
    }
}

function buildUnavailableIdentityResponse(
    address: string,
    err: WalletIdentityServiceError,
): WalletIdentityResponse {
    return {
        address,
        identity: buildUnavailableIdentity(),
        metadata: {
            cache: {
                hit: false,
                stale: false,
                ttlSec: 0,
            },
            provider: {
                statusCode: err.providerStatusCode,
                errorCode: err.code,
            },
        },
    };
}

async function composeFromIdentityResponse(
    identityResponse: WalletIdentityResponse,
    options?: ComposeWalletIntelligenceOptions,
): Promise<WalletIntelligenceResponse> {
    const [analysisInputs, userTags, firstFund] = await Promise.all([
        getAnalysisInputs(identityResponse.address),
        options?.includeUserTags === false
            ? Promise.resolve([])
            : getOptionalUserTags(options?.userId, identityResponse.address),
        getWalletFirstFund(identityResponse.address)
            .then((value) => buildWalletFirstFundInsight(identityResponse.address, value))
            .catch(() => null),
    ]);

    const analysis = buildWalletIdentityAnalysis({
        identity: identityResponse.identity,
        analysisInputs,
        firstFund,
        userTags,
    });

    return {
        address: identityResponse.address,
        identity: identityResponse.identity,
        analysis,
        metadata: {
            cache: {
                identityHit: identityResponse.metadata.cache.hit,
                analysisHit: analysisInputs.analyticsComplete,
                ttlSec: identityResponse.metadata.cache.ttlSec,
                staleIdentity: identityResponse.metadata.cache.stale,
            },
            provider: {
                statusCode: identityResponse.metadata.provider.statusCode,
                errorCode: identityResponse.metadata.provider.errorCode,
            },
        },
    };
}

export async function composeWalletIntelligence(
    address: string,
    options?: ComposeWalletIntelligenceOptions,
): Promise<WalletIntelligenceResponse> {
    let identityResponse: WalletIdentityResponse;

    try {
        identityResponse = await getWalletIdentity(address);
    } catch (err) {
        if (isRecoverableProviderError(err)) {
            identityResponse = buildUnavailableIdentityResponse(address, err);
        } else {
            throw err;
        }
    }

    return composeFromIdentityResponse(identityResponse, options);
}

export async function composeWalletIntelligenceBatch(
    addresses: string[],
    options?: ComposeWalletIntelligenceOptions,
): Promise<WalletIntelligenceBatchResponse> {
    const identityBatch = await getWalletIdentityBatch(addresses);

    const intelligenceResults = await Promise.all(
        identityBatch.results.map((identityResponse) =>
            composeFromIdentityResponse(identityResponse, options),
        ),
    );

    return {
        results: intelligenceResults,
    };
}
