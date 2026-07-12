import type {
    EvidenceBundle,
    WalletBehaviorProfile,
    WalletPersonaType,
} from "../types/walletBehaviorProfile";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import { clamp } from "../utils/mathUtils";
import { isSolLikeMint, isStablecoinMint } from "../utils/tokenUtils";

export type PersonaScoreMap = Record<WalletPersonaType, number>;

export type PersonaRuleContext = {
    profile: WalletBehaviorProfile;
    events: NormalizedWalletEvent[];
    counts: {
        nftEventCount: number;
        airdropClaimCount: number;
        tokenTransferInCount: number;
    };
};

export type PersonaRuleResult = {
    persona: WalletPersonaType;
    score: number;
    evidence: EvidenceBundle[];
    reasoning: string[];
    allowAsPrimary: boolean;
};

export const PERSONA_TYPES: WalletPersonaType[] = [
    "UNKNOWN",
    "LONG_TERM_HOLDER",
    "CASUAL_USER",
    "DEFI_TRADER",
    "MEMECOIN_TRADER",
    "NFT_COLLECTOR",
    "AIRDROP_FARMER",
    "BOT_LIKE_TRADER",
    "HIGH_RISK_SPECULATOR",
    "SMART_MONEY_LIKE",
    "WASH_TRADING_SUSPECT",
];

export function createPersonaScoreMap(): PersonaScoreMap {
    return Object.fromEntries(PERSONA_TYPES.map((persona) => [persona, 0])) as PersonaScoreMap;
}

export function normalizePersonaScores(scores: PersonaScoreMap): PersonaScoreMap {
    const normalized = createPersonaScoreMap();
    for (const persona of PERSONA_TYPES) {
        normalized[persona] = clamp(scores[persona] ?? 0, 0, 100);
    }
    return normalized;
}

export function getPersonaPrimaryCandidate(scores: PersonaScoreMap): WalletPersonaType {
    return PERSONA_TYPES.filter((persona) => persona !== "UNKNOWN")
        .sort((left, right) => scores[right] - scores[left])[0] ?? "UNKNOWN";
}

export function getPersonaSecondaryCandidates(scores: PersonaScoreMap, primaryPersona: WalletPersonaType): WalletPersonaType[] {
    return PERSONA_TYPES.filter((persona) => persona !== "UNKNOWN" && persona !== primaryPersona && scores[persona] >= 50)
        .sort((left, right) => scores[right] - scores[left])
        .slice(0, 3);
}

export function computePersonaConfidence(params: {
    primaryNormalizedScore: number;
    secondNormalizedScore: number;
    profile: WalletBehaviorProfile;
    primaryPersona: WalletPersonaType;
}): number {
    if (params.primaryPersona === "UNKNOWN") {
        return 0;
    }

    const scoreGap = params.primaryNormalizedScore - params.secondNormalizedScore;
    let confidence = 0.35
        + (params.primaryNormalizedScore / 100) * 0.35
        + (scoreGap / 100) * 0.15
        + (params.profile.dataQuality.completenessScore / 100) * 0.15;

    if (params.profile.analysisWindow.actualTransactionCount < 20) {
        confidence -= 0.2;
    }
    if (params.profile.dataQuality.completenessScore < 50) {
        confidence -= 0.15;
    }

    return clamp(confidence, 0, 1);
}

function createEvidence(
    id: string,
    type: EvidenceBundle["type"],
    title: string,
    description: string,
    value: number | string | null,
    threshold: number | string | null,
    severity: EvidenceBundle["severity"],
    relatedSignatures?: string[],
    relatedTokenMints?: string[],
): EvidenceBundle {
    return {
        id,
        type,
        title,
        description,
        value,
        threshold,
        severity,
        relatedSignatures,
        relatedTokenMints,
    };
}

function countNftEvents(events: NormalizedWalletEvent[]): number {
    return events.filter((event) =>
        event.type === "NFT_TRANSFER_IN"
        || event.type === "NFT_TRANSFER_OUT"
        || event.type === "NFT_PURCHASE"
        || event.type === "NFT_SALE"
        || event.nftEvent != null,
    ).length;
}

function countAirdropClaimEvents(events: NormalizedWalletEvent[]): number {
    return events.filter((event) => event.type === "AIRDROP_CLAIM").length;
}

function countTokenTransferInEvents(events: NormalizedWalletEvent[]): number {
    return events.filter((event) => event.type === "TOKEN_TRANSFER_IN").length;
}

function hasNftMarketplaceProtocol(profile: WalletBehaviorProfile): boolean {
    return profile.protocolUsage.protocols.some((protocol) =>
        protocol.protocolName === "Tensor" || protocol.protocolName === "Magic Eden",
    );
}

function scoreLongTermHolder(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.trading.swapCount <= 3) {
        score += 25;
        evidence.push(createEvidence(
            "ev_persona_low_swap_count",
            "METRIC_THRESHOLD",
            "Very low swap count",
            `Trading activity shows only ${profile.trading.swapCount} swap events.`,
            profile.trading.swapCount,
            3,
            "LOW",
        ));
        reasoning.push("Trading activity is consistent with a low-frequency wallet.");
    }

    if (profile.trading.longTermHoldRatio != null && profile.trading.longTermHoldRatio >= 0.6) {
        score += 35;
        evidence.push(createEvidence(
            "ev_persona_long_holding_ratio",
            "METRIC_THRESHOLD",
            "High long-term holding ratio",
            `Long-term holding ratio is ${Math.round(profile.trading.longTermHoldRatio * 100)}%.`,
            profile.trading.longTermHoldRatio,
            0.6,
            "HIGH",
        ));
        reasoning.push("Holding periods suggest a long-term holding pattern.");
    }

    if (profile.activity.activityLevel === "LOW") {
        score += 15;
        reasoning.push("Overall activity level is low.");
    }

    if (profile.portfolio.concentration.concentrationRisk === "HIGH") {
        score += 10;
        reasoning.push("Portfolio concentration is high, which is often consistent with holding behavior.");
    }

    if (profile.trading.shortTermTradeRatio != null && profile.trading.shortTermTradeRatio <= 0.2) {
        score += 15;
        reasoning.push("Short-term trading share is low.");
    }

    return {
        persona: "LONG_TERM_HOLDER",
        score,
        evidence,
        reasoning,
        allowAsPrimary: profile.trading.swapCount < 20,
    };
}

function scoreCasualUser(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.activity.activityLevel === "LOW" || profile.activity.activityLevel === "MEDIUM") {
        score += 20;
        reasoning.push("Activity level is not high-intensity.");
    }

    if (profile.trading.swapCount > 0 && profile.trading.swapCount < 20) {
        score += 25;
        reasoning.push("Swap count is in the casual usage range.");
    }

    if (profile.trading.uniqueTokensTraded <= 5) {
        score += 15;
        reasoning.push("Only a small number of tokens were traded.");
    }

    if (profile.protocolUsage.protocols.length <= 3) {
        score += 10;
        reasoning.push("Protocol usage is limited to a few services.");
    }

    if (profile.pnl.closedPositionCount <= 3) {
        score += 10;
        reasoning.push("Only a few positions have been closed.");
    }

    return { persona: "CASUAL_USER", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreDefiTrader(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.trading.swapCount >= 20) {
        score += 25;
        reasoning.push("Swap count indicates sustained DeFi participation.");
        evidence.push(createEvidence(
            "ev_persona_high_swap_count",
            "METRIC_THRESHOLD",
            "High swap activity",
            `Wallet executed ${profile.trading.swapCount} swap events.`,
            profile.trading.swapCount,
            20,
            "MEDIUM",
        ));
    }

    if (profile.trading.swapCount >= 50) {
        score += 15;
    }

    if (profile.protocolUsage.dexUsageRatio != null && profile.protocolUsage.dexUsageRatio >= 0.5) {
        score += 25;
        reasoning.push("DEX usage dominates the activity mix.");
        evidence.push(createEvidence(
            "ev_persona_high_dex_usage",
            "PROTOCOL_USAGE",
            "High DEX usage",
            `DEX usage ratio is ${Math.round(profile.protocolUsage.dexUsageRatio * 100)}%.`,
            profile.protocolUsage.dexUsageRatio,
            0.5,
            "HIGH",
        ));
    }

    if (profile.trading.uniqueTokensTraded >= 10) {
        score += 20;
        reasoning.push("Wallet trades across many distinct tokens.");
    }

    if (profile.trading.totalVolumeUsd != null && profile.trading.totalVolumeUsd >= 1000) {
        score += 15;
        reasoning.push("Trading volume is material.");
    }

    return { persona: "DEFI_TRADER", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreMemecoinTrader(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [
        "This classification uses trading behavior proxies because token category metadata is not yet available.",
    ];

    if (profile.trading.uniqueTokensTraded >= 20) {
        score += 25;
        reasoning.push("Token diversity is very high.");
    }

    if (profile.trading.shortTermTradeRatio != null && profile.trading.shortTermTradeRatio >= 0.5) {
        score += 25;
        reasoning.push("A large portion of trades are short-term.");
        evidence.push(createEvidence(
            "ev_persona_short_holding",
            "METRIC_THRESHOLD",
            "High short-term trade ratio",
            `Short-term trade ratio is ${Math.round(profile.trading.shortTermTradeRatio * 100)}%.`,
            profile.trading.shortTermTradeRatio,
            0.5,
            "HIGH",
        ));
    }

    if (profile.protocolUsage.dexUsageRatio != null && profile.protocolUsage.dexUsageRatio >= 0.7) {
        score += 15;
        reasoning.push("DEX usage is heavy.");
    }

    if (profile.trading.averageTradeSizeUsd != null && profile.trading.averageTradeSizeUsd <= 200) {
        score += 10;
        reasoning.push("Average trade size is relatively small.");
    }

    if (profile.trading.swapCount >= 50) {
        score += 15;
        reasoning.push("Swap count is high enough to match speculative token activity.");
    }

    return { persona: "MEMECOIN_TRADER", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreNftCollector(context: PersonaRuleContext): PersonaRuleResult {
    const { profile, counts } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.portfolio.nftCount != null && profile.portfolio.nftCount >= 3) {
        score += 25;
        reasoning.push("Portfolio reports multiple NFTs.");
        evidence.push(createEvidence(
            "ev_persona_nft_portfolio",
            "TOKEN_HOLDING",
            "NFT holdings present",
            `Portfolio contains ${profile.portfolio.nftCount} NFTs.`,
            profile.portfolio.nftCount,
            3,
            "MEDIUM",
        ));
    }

    if (profile.protocolUsage.nftMarketplaceUsageRatio != null && profile.protocolUsage.nftMarketplaceUsageRatio >= 0.3) {
        score += 35;
        reasoning.push("NFT marketplace usage is prominent.");
        evidence.push(createEvidence(
            "ev_persona_nft_marketplace_usage",
            "PROTOCOL_USAGE",
            "High NFT marketplace usage",
            `NFT marketplace usage ratio is ${Math.round(profile.protocolUsage.nftMarketplaceUsageRatio * 100)}%.`,
            profile.protocolUsage.nftMarketplaceUsageRatio,
            0.3,
            "HIGH",
        ));
    }

    if (hasNftMarketplaceProtocol(profile)) {
        score += 20;
        reasoning.push("Known NFT marketplace protocols are present in the profile.");
    }

    if (counts.nftEventCount >= 3) {
        score += 20;
        reasoning.push("NFT-related events appear multiple times in the event stream.");
    }

    return { persona: "NFT_COLLECTOR", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreAirdropFarmer(context: PersonaRuleContext): PersonaRuleResult {
    const { profile, counts } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (counts.airdropClaimCount >= 5) {
        score += 40;
        reasoning.push("Explicit airdrop claim events are present in volume.");
        evidence.push(createEvidence(
            "ev_persona_airdrop_claims",
            "TRANSACTION_SIGNATURES",
            "Repeated airdrop claims",
            `Detected ${counts.airdropClaimCount} airdrop claim events.`,
            counts.airdropClaimCount,
            5,
            "HIGH",
        ));
    }

    if (counts.tokenTransferInCount >= 20) {
        score += 20;
        reasoning.push("Inbound token transfer count is high.");
    }

    if (profile.trading.uniqueTokensTraded >= 20 && profile.trading.averageTradeSizeUsd != null && profile.trading.averageTradeSizeUsd < 50) {
        score += 15;
        reasoning.push("Broad token coverage with small average trade size suggests farming-like behavior.");
    }

    if (profile.activity.maxTransactionsInOneHour >= 20) {
        score += 15;
        reasoning.push("Burst activity is high enough to be compatible with claim-hunting behavior.");
    }

    if (profile.dataQuality.unsupportedTransactionCount > 10) {
        score += 5;
        reasoning.push("Unsupported transaction count is elevated, so inference remains cautious.");
    }

    return { persona: "AIRDROP_FARMER", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreBotLikeTrader(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.activity.activityLevel === "EXTREME") {
        score += 25;
        reasoning.push("Activity level is extreme.");
    }

    if (profile.activity.burstActivityScore >= 70) {
        score += 25;
        reasoning.push("Burst activity score is elevated.");
        evidence.push(createEvidence(
            "ev_persona_bot_burst_activity",
            "METRIC_THRESHOLD",
            "High burst activity",
            `Burst activity score is ${Math.round(profile.activity.burstActivityScore)}.`,
            profile.activity.burstActivityScore,
            70,
            "HIGH",
        ));
    }

    if (profile.activity.maxTransactionsInOneHour >= 30) {
        score += 25;
        reasoning.push("Transactions cluster heavily within single hours.");
    }

    if (profile.activity.medianTimeBetweenTransactionsSeconds != null && profile.activity.medianTimeBetweenTransactionsSeconds <= 60) {
        score += 20;
        reasoning.push("Transactions are separated by short median gaps.");
    }

    if (profile.trading.swapCount >= 100) {
        score += 15;
        reasoning.push("Swap count is very high.");
    }

    return { persona: "BOT_LIKE_TRADER", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreHighRiskSpeculator(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.trading.shortTermTradeRatio != null && profile.trading.shortTermTradeRatio >= 0.5) {
        score += 25;
        reasoning.push("Short-term trading ratio is high.");
    }

    if (profile.trading.uniqueTokensTraded >= 20) {
        score += 20;
        reasoning.push("Token diversity is high.");
    }

    if (profile.pnl.realizedPnlUsd != null && profile.pnl.realizedPnlUsd < 0) {
        score += 15;
        reasoning.push("Realized PnL is negative.");
        evidence.push(createEvidence(
            "ev_persona_negative_pnl",
            "PNL_RESULT",
            "Negative realized PnL",
            `Realized PnL is ${profile.pnl.realizedPnlUsd.toFixed(2)} USD.`,
            profile.pnl.realizedPnlUsd,
            0,
            "HIGH",
        ));
    }

    if (profile.pnl.winRate != null && profile.pnl.winRate < 0.45) {
        score += 15;
        reasoning.push("Win rate is below a conservative threshold.");
    }

    if (profile.protocolUsage.dexUsageRatio != null && profile.protocolUsage.dexUsageRatio >= 0.7) {
        score += 15;
        reasoning.push("DEX usage is highly concentrated.");
    }

    if (profile.trading.tradingStyle === "SNIPER") {
        score += 20;
        reasoning.push("Trading style is consistent with sniper-like behavior.");
    }

    return { persona: "HIGH_RISK_SPECULATOR", score, evidence, reasoning, allowAsPrimary: true };
}

function scoreSmartMoneyLike(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.pnl.realizedPnlUsd != null && profile.pnl.realizedPnlUsd > 0) {
        score += 25;
        reasoning.push("Realized PnL is positive.");
        evidence.push(createEvidence(
            "ev_persona_positive_pnl",
            "PNL_RESULT",
            "Positive realized PnL",
            `Realized PnL is ${profile.pnl.realizedPnlUsd.toFixed(2)} USD.`,
            profile.pnl.realizedPnlUsd,
            0,
            "MEDIUM",
        ));
    }

    if (profile.pnl.winRate != null && profile.pnl.winRate >= 0.55) {
        score += 20;
        reasoning.push("Win rate is above the conservative threshold.");
    }

    if (profile.pnl.profitFactor != null && profile.pnl.profitFactor >= 1.5) {
        score += 25;
        reasoning.push("Profit factor is healthy.");
    }

    if (profile.pnl.closedPositionCount >= 10) {
        score += 15;
        reasoning.push("Closed position count is substantial.");
    }

    if (profile.trading.uniqueTokensTraded <= 20) {
        score += 10;
        reasoning.push("Token universe is relatively focused.");
    }

    return { persona: "SMART_MONEY_LIKE", score, evidence, reasoning, allowAsPrimary: profile.pnl.closedPositionCount >= 5 };
}

function scoreWashTradingSuspect(context: PersonaRuleContext): PersonaRuleResult {
    const { profile } = context;
    let score = 0;
    const evidence: EvidenceBundle[] = [];
    const reasoning: string[] = [];

    if (profile.washTrading.suspicionScore >= 70) {
        score += 60;
        reasoning.push("Wash trading suspicion score is high.");
        evidence.push(createEvidence(
            "ev_persona_wash_score",
            "GRAPH_PATTERN",
            "High wash trading suspicion score",
            `Wash trading suspicion score is ${Math.round(profile.washTrading.suspicionScore)}.`,
            profile.washTrading.suspicionScore,
            70,
            "HIGH",
        ));
    }

    if (profile.washTrading.suspicionLevel === "HIGH") {
        score += 40;
        reasoning.push("Wash trading suspicion level is high.");
    }

    if (profile.washTrading.signals.length >= 2) {
        score += 20;
        reasoning.push("Multiple wash trading signals are present.");
    }

    return { persona: "WASH_TRADING_SUSPECT", score, evidence, reasoning, allowAsPrimary: true };
}

export function scorePersonaRules(context: PersonaRuleContext): {
    scores: PersonaScoreMap;
    results: PersonaRuleResult[];
    evidence: EvidenceBundle[];
    reasoningByPersona: Record<WalletPersonaType, string[]>;
} {
    const results = [
        scoreLongTermHolder(context),
        scoreCasualUser(context),
        scoreDefiTrader(context),
        scoreMemecoinTrader(context),
        scoreNftCollector(context),
        scoreAirdropFarmer(context),
        scoreBotLikeTrader(context),
        scoreHighRiskSpeculator(context),
        scoreSmartMoneyLike(context),
        scoreWashTradingSuspect(context),
    ];

    const scores = createPersonaScoreMap();
    for (const result of results) {
        scores[result.persona] = clamp(result.score, 0, 100);
    }
    scores.UNKNOWN = 0;

    const evidence = new Map<string, EvidenceBundle>();
    for (const result of results) {
        for (const bundle of result.evidence) {
            if (!evidence.has(bundle.id)) {
                evidence.set(bundle.id, bundle);
            }
        }
    }

    const reasoningByPersona = Object.fromEntries(PERSONA_TYPES.map((persona) => [persona, [] as string[]])) as Record<WalletPersonaType, string[]>;
    for (const result of results) {
        reasoningByPersona[result.persona] = result.reasoning;
    }

    return {
        scores,
        results,
        evidence: [...evidence.values()],
        reasoningByPersona,
    };
}

export function isStableOrSolMint(mint: string): boolean {
    return isStablecoinMint(mint) || isSolLikeMint(mint);
}

export function personaEvidenceIds(results: PersonaRuleResult[], persona: WalletPersonaType): string[] {
    return results
        .find((result) => result.persona === persona)
        ?.evidence.map((bundle) => bundle.id) ?? [];
}

export function selectPersonaPrimary(scores: PersonaScoreMap, allowedPrimary: Record<WalletPersonaType, boolean>): WalletPersonaType {
    const eligible = PERSONA_TYPES.filter((persona) => persona !== "UNKNOWN" && allowedPrimary[persona]);
    if (eligible.length === 0) {
        return "UNKNOWN";
    }

    return eligible.sort((left, right) => scores[right] - scores[left])[0] ?? "UNKNOWN";
}

export function totalNftSignalCount(events: NormalizedWalletEvent[]): number {
    return countNftEvents(events);
}

export function totalAirdropClaimCount(events: NormalizedWalletEvent[]): number {
    return countAirdropClaimEvents(events);
}

export function totalTokenTransferInCount(events: NormalizedWalletEvent[]): number {
    return countTokenTransferInEvents(events);
}