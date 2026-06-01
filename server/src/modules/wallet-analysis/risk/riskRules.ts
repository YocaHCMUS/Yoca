import type { EvidenceBundle, RiskFactor, WalletBehaviorProfile, WalletRiskProfile } from "../types/walletBehaviorProfile";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import { isBuyLikeSwapDirection, isPositionTokenMint, isSellLikeSwapDirection } from "../utils/pnlUtils";
import { clamp } from "../utils/mathUtils";
import { diffHours, getUtcHourKey, sortEventsByTimestampAsc } from "../utils/timeUtils";
import { isSolLikeMint, isStablecoinMint } from "../utils/tokenUtils";

export type RiskRuleContext = {
    profile: WalletBehaviorProfile;
    events?: NormalizedWalletEvent[];
};

export type RiskRuleResult = {
    code: RiskFactor["code"];
    impact: number;
    evidence?: EvidenceBundle;
    description: string;
    relatedEvidenceIds?: string[];
};

export type RiskEvaluation = {
    risk: WalletRiskProfile;
    evidence: EvidenceBundle[];
    factors: RiskFactor[];
    topFactorDescriptions: string[];
};

export function severityFromImpact(impact: number): RiskFactor["severity"] {
    if (impact >= 15) {
        return "HIGH";
    }
    if (impact >= 8) {
        return "MEDIUM";
    }
    return "LOW";
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
        relatedSignatures,
        relatedTokenMints,
        value,
        threshold,
        severity,
    };
}

function cap(impact: number, limit: number): number {
    return Math.max(0, Math.min(impact, limit));
}

function limitUnique(values: string[], limit: number): string[] {
    const seen = new Set<string>();
    const limited: string[] = [];

    for (const value of values) {
        if (seen.has(value)) {
            continue;
        }

        seen.add(value);
        limited.push(value);

        if (limited.length >= limit) {
            break;
        }
    }

    return limited;
}

function getSwapEvents(events: NormalizedWalletEvent[]): NormalizedWalletEvent[] {
    return sortEventsByTimestampAsc(events).filter((event) => event.type === "SWAP" && event.swap != null);
}

function getBusiestUtcHour(events: NormalizedWalletEvent[]): { hourKey: string; count: number; signatures: string[] } | null {
    const buckets = new Map<string, { count: number; signatures: string[] }>();

    for (const event of events) {
        const hourKey = getUtcHourKey(event.timestamp);
        const current = buckets.get(hourKey) ?? { count: 0, signatures: [] };
        current.count += 1;
        current.signatures.push(event.signature);
        buckets.set(hourKey, current);
    }

    let winner: { hourKey: string; count: number; signatures: string[] } | null = null;
    for (const [hourKey, bucket] of buckets.entries()) {
        if (winner == null || bucket.count > winner.count || (bucket.count === winner.count && hourKey < winner.hourKey)) {
            winner = { hourKey, count: bucket.count, signatures: bucket.signatures };
        }
    }

    return winner;
}

type ClosedTradeSignaturePair = {
    buySignature: string;
    sellSignature: string;
    holdingHours: number;
};

function getClosedTradeSignaturePairs(events: NormalizedWalletEvent[]): ClosedTradeSignaturePair[] {
    const lotsByToken = new Map<string, Array<{ buySignature: string; amount: number; boughtAt: string }>>();
    const pairs: ClosedTradeSignaturePair[] = [];

    for (const event of getSwapEvents(events)) {
        const swap = event.swap;
        if (swap == null) {
            continue;
        }

        if (isBuyLikeSwapDirection(swap.tradeDirectionForWallet) && isPositionTokenMint(swap.outputMint) && swap.outputAmount > 0) {
            const existingLots = lotsByToken.get(swap.outputMint) ?? [];
            existingLots.push({ buySignature: event.signature, amount: swap.outputAmount, boughtAt: event.timestamp });
            lotsByToken.set(swap.outputMint, existingLots);
            continue;
        }

        if (!isSellLikeSwapDirection(swap.tradeDirectionForWallet) || !isPositionTokenMint(swap.inputMint) || swap.inputAmount <= 0) {
            continue;
        }

        const existingLots = lotsByToken.get(swap.inputMint);
        if (existingLots == null || existingLots.length === 0) {
            continue;
        }

        let sellRemaining = swap.inputAmount;
        while (sellRemaining > 0 && existingLots.length > 0) {
            const lot = existingLots[0];
            const consumedAmount = Math.min(lot.amount, sellRemaining);
            if (consumedAmount <= 0) {
                break;
            }

            pairs.push({
                buySignature: lot.buySignature,
                sellSignature: event.signature,
                holdingHours: diffHours(lot.boughtAt, event.timestamp),
            });

            lot.amount -= consumedAmount;
            sellRemaining -= consumedAmount;

            if (lot.amount <= 1e-12) {
                existingLots.shift();
            }
        }

        if (existingLots.length > 0) {
            lotsByToken.set(swap.inputMint, existingLots);
        } else {
            lotsByToken.delete(swap.inputMint);
        }
    }

    return pairs;
}

function getShortHoldingEvidenceSignatures(events: NormalizedWalletEvent[]): string[] {
    const shortPairs = getClosedTradeSignaturePairs(events).filter((pair) => pair.holdingHours <= 24);

    if (shortPairs.length > 0) {
        return limitUnique(shortPairs.flatMap((pair) => [pair.buySignature, pair.sellSignature]), 5);
    }

    return limitUnique(
        getSwapEvents(events)
            .filter((event) => isSellLikeSwapDirection(event.swap!.tradeDirectionForWallet) || isBuyLikeSwapDirection(event.swap!.tradeDirectionForWallet))
            .map((event) => event.signature),
        5,
    );
}

function getClosedPnlSellSignatures(events: NormalizedWalletEvent[]): string[] {
    const closedPairs = getClosedTradeSignaturePairs(events);
    if (closedPairs.length > 0) {
        return limitUnique(closedPairs.map((pair) => pair.sellSignature), 5);
    }

    return limitUnique(
        getSwapEvents(events)
            .filter((event) => isSellLikeSwapDirection(event.swap!.tradeDirectionForWallet))
            .map((event) => event.signature),
        5,
    );
}

function getNonStableNonSolTradeMints(events: NormalizedWalletEvent[]): string[] {
    const mints: string[] = [];

    for (const event of getSwapEvents(events)) {
        const swap = event.swap;
        if (swap == null) {
            continue;
        }

        for (const mint of [swap.inputMint, swap.outputMint]) {
            if (!isPositionTokenMint(mint) || isStablecoinMint(mint) || isSolLikeMint(mint)) {
                continue;
            }

            mints.push(mint);
        }
    }

    return limitUnique(mints, 8);
}

function buildFactor(
    code: RiskFactor["code"],
    impact: number,
    description: string,
    evidenceId: string,
): { factor: RiskFactor; evidence: EvidenceBundle } {
    return {
        factor: {
            code,
            severity: severityFromImpact(impact),
            scoreImpact: impact,
            description,
            evidenceIds: [evidenceId],
        },
        evidence: createEvidence(
            evidenceId,
            code === "NEGATIVE_PNL" || code === "LOW_WIN_RATE" ? "PNL_RESULT" : code === "HIGH_PORTFOLIO_CONCENTRATION" ? "TOKEN_HOLDING" : code === "WASH_TRADING_SUSPECTED" ? "GRAPH_PATTERN" : "METRIC_THRESHOLD",
            evidenceId,
            description,
            impact,
            null,
            severityFromImpact(impact),
        ),
    };
}

function evaluateHighFrequencyActivity(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult {
    let impact = 0;

    if (profile.activity.activityLevel === "EXTREME") {
        impact += 12;
    }
    if (profile.activity.burstActivityScore >= 70) {
        impact += 10;
    }
    if (profile.activity.maxTransactionsInOneHour >= 30) {
        impact += 10;
    }
    if (profile.activity.medianTimeBetweenTransactionsSeconds != null && profile.activity.medianTimeBetweenTransactionsSeconds <= 60) {
        impact += 8;
    }

    impact = cap(impact, 20);

    const busiestHour = events != null && events.length > 0 ? getBusiestUtcHour(events) : null;
    const relatedSignatures = busiestHour != null ? limitUnique(busiestHour.signatures, 5) : undefined;
    const description = busiestHour != null
        ? `Activity is concentrated with a ${profile.activity.activityLevel.toLowerCase()} activity level, a burst score of ${Math.round(profile.activity.burstActivityScore)}, and a busiest UTC hour containing ${busiestHour.count} transactions.`
        : `Activity is concentrated with a ${profile.activity.activityLevel.toLowerCase()} activity level and a burst score of ${Math.round(profile.activity.burstActivityScore)}.`;

    return {
        code: "HIGH_FREQUENCY_ACTIVITY",
        impact,
        description,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_high_frequency_activity",
                relatedSignatures != null ? "TRANSACTION_SIGNATURES" : "METRIC_THRESHOLD",
                "High frequency activity",
                busiestHour != null
                    ? `Activity level ${profile.activity.activityLevel}, burst score ${Math.round(profile.activity.burstActivityScore)}, max transactions in one hour ${profile.activity.maxTransactionsInOneHour}, busiest UTC hour count ${busiestHour.count}.`
                    : `Activity level ${profile.activity.activityLevel}, burst score ${Math.round(profile.activity.burstActivityScore)}, max transactions in one hour ${profile.activity.maxTransactionsInOneHour}.`,
                profile.activity.burstActivityScore,
                70,
                severityFromImpact(impact),
                relatedSignatures,
            )
            : undefined,
    };
}

function evaluateShortHoldingPeriod(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult {
    let impact = 0;

    if (profile.trading.shortTermTradeRatio != null && profile.trading.shortTermTradeRatio >= 0.5) {
        impact += 12;
    }
    if (profile.trading.shortTermTradeRatio != null && profile.trading.shortTermTradeRatio >= 0.75) {
        impact += 8;
    }
    if (profile.trading.medianHoldingPeriodHours != null && profile.trading.medianHoldingPeriodHours <= 1) {
        impact += 8;
    }
    if (profile.trading.tradingStyle === "SNIPER") {
        impact += 10;
    }

    impact = cap(impact, 22);

    const relatedSignatures = events != null && events.length > 0 ? getShortHoldingEvidenceSignatures(events) : undefined;

    return {
        code: "SHORT_HOLDING_PERIOD",
        impact,
        description: profile.trading.shortTermTradeRatio != null
            ? `Short-term trade ratio is ${Math.round(profile.trading.shortTermTradeRatio * 100)}% with a median holding period of ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours.`
            : `Median holding period is ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_short_holding",
                relatedSignatures != null ? "TRANSACTION_SIGNATURES" : "METRIC_THRESHOLD",
                "Short holding period risk",
                `Short-term trade ratio ${profile.trading.shortTermTradeRatio ?? "unknown"}, median holding period ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours, trading style ${profile.trading.tradingStyle}.`,
                profile.trading.shortTermTradeRatio ?? null,
                0.5,
                severityFromImpact(impact),
                relatedSignatures,
            )
            : undefined,
    };
}

function evaluateNegativePnl(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult {
    let impact = 0;

    if (profile.pnl.realizedPnlUsd != null && profile.pnl.realizedPnlUsd < 0) {
        impact += 8;
    }
    if (profile.pnl.realizedPnlUsd != null && profile.pnl.realizedPnlUsd <= -100) {
        impact += 5;
    }
    if (profile.pnl.realizedPnlUsd != null && profile.pnl.realizedPnlUsd <= -1000) {
        impact += 7;
    }

    impact = cap(impact, 18);

    const relatedSignatures = events != null && events.length > 0 ? getClosedPnlSellSignatures(events) : undefined;

    return {
        code: "NEGATIVE_PNL",
        impact,
        description: profile.pnl.realizedPnlUsd != null
            ? `Realized PnL is ${profile.pnl.realizedPnlUsd.toFixed(2)} USD.`
            : "Realized PnL is unavailable.",
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_negative_pnl",
                relatedSignatures != null ? "TRANSACTION_SIGNATURES" : "PNL_RESULT",
                "Negative realized PnL",
                `Realized PnL is ${profile.pnl.realizedPnlUsd?.toFixed(2) ?? "unknown"} USD.`,
                profile.pnl.realizedPnlUsd ?? null,
                0,
                severityFromImpact(impact),
                relatedSignatures,
            )
            : undefined,
    };
}

function evaluateLowWinRate(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult {
    let impact = 0;

    if (profile.pnl.closedPositionCount >= 5 && profile.pnl.winRate != null && profile.pnl.winRate < 0.45) {
        impact += 8;
    }
    if (profile.pnl.closedPositionCount >= 10 && profile.pnl.winRate != null && profile.pnl.winRate < 0.35) {
        impact += 6;
    }

    impact = cap(impact, 14);

    const relatedSignatures = events != null && events.length > 0 ? getClosedPnlSellSignatures(events) : undefined;

    return {
        code: "LOW_WIN_RATE",
        impact,
        description: profile.pnl.winRate != null
            ? `Win rate is ${Math.round(profile.pnl.winRate * 100)}% across ${profile.pnl.closedPositionCount} closed positions.`
            : `Win rate is unavailable across ${profile.pnl.closedPositionCount} closed positions.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_low_win_rate",
                relatedSignatures != null ? "TRANSACTION_SIGNATURES" : "PNL_RESULT",
                "Low win rate",
                `Win rate ${profile.pnl.winRate ?? "unknown"} across ${profile.pnl.closedPositionCount} closed positions.`,
                profile.pnl.winRate ?? null,
                0.45,
                severityFromImpact(impact),
                relatedSignatures,
            )
            : undefined,
    };
}

function evaluateHighTokenDiversity(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult {
    let impact = 0;

    if (profile.trading.uniqueTokensTraded >= 20) {
        impact += 8;
    }
    if (profile.trading.uniqueTokensTraded >= 50) {
        impact += 7;
    }

    impact = cap(impact, 15);

    const relatedTokenMints = events != null && events.length > 0 ? getNonStableNonSolTradeMints(events) : undefined;

    return {
        code: "HIGH_TOKEN_DIVERSITY",
        impact,
        description: `Wallet traded ${profile.trading.uniqueTokensTraded} unique tokens in the analyzed window.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_high_token_diversity",
                "METRIC_THRESHOLD",
                "High token diversity",
                `Unique tokens traded: ${profile.trading.uniqueTokensTraded}.`,
                profile.trading.uniqueTokensTraded,
                20,
                severityFromImpact(impact),
                undefined,
                relatedTokenMints,
            )
            : undefined,
    };
}

function evaluatePortfolioConcentration(profile: WalletBehaviorProfile): RiskRuleResult {
    let impact = 0;

    if (profile.portfolio.concentration.concentrationRisk === "MEDIUM") {
        impact += 5;
    }
    if (profile.portfolio.concentration.concentrationRisk === "HIGH") {
        impact += 12;
    }
    if (profile.portfolio.concentration.top1HoldingRatio != null && profile.portfolio.concentration.top1HoldingRatio >= 0.8) {
        impact += 5;
    }

    impact = cap(impact, 15);

    return {
        code: "HIGH_PORTFOLIO_CONCENTRATION",
        impact,
        description: profile.portfolio.concentration.concentrationRisk === "UNKNOWN"
            ? "Portfolio concentration is unknown."
            : `Portfolio concentration risk is ${profile.portfolio.concentration.concentrationRisk}.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_portfolio_concentration",
                "TOKEN_HOLDING",
                "Portfolio concentration risk",
                `Top 1 holding ratio ${profile.portfolio.concentration.top1HoldingRatio ?? "unknown"}, concentration risk ${profile.portfolio.concentration.concentrationRisk}.`,
                profile.portfolio.concentration.top1HoldingRatio ?? null,
                0.8,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateWashTradingSuspicion(profile: WalletBehaviorProfile): RiskRuleResult {
    let impact = 0;

    if (profile.washTrading.suspicionScore >= 50) {
        impact += 15;
    }
    if (profile.washTrading.suspicionScore >= 70) {
        impact += 15;
    }
    if (profile.washTrading.suspicionLevel === "HIGH") {
        impact += 20;
    }
    if (profile.washTrading.signals.length >= 2) {
        impact += 10;
    }

    impact = cap(impact, 30);
    const signalEvidenceIds = limitUnique(profile.washTrading.signals.flatMap((signal) => signal.evidenceIds), 10);

    return {
        code: "WASH_TRADING_SUSPECTED",
        impact,
        description: `Wash trading suspicion is ${profile.washTrading.suspicionLevel.toLowerCase()} with score ${Math.round(profile.washTrading.suspicionScore)}.`,
        relatedEvidenceIds: signalEvidenceIds.length > 0 ? signalEvidenceIds : undefined,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_wash_trading_suspected",
                "GRAPH_PATTERN",
                "Wash trading suspicion",
                `Suspicion score ${Math.round(profile.washTrading.suspicionScore)}, level ${profile.washTrading.suspicionLevel}, signals ${profile.washTrading.signals.length}.`,
                profile.washTrading.suspicionScore,
                50,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateMissingData(profile: WalletBehaviorProfile): RiskRuleResult {
    let impact = 0;

    if (profile.dataQuality.completenessScore < 70) {
        impact += 5;
    }
    if (profile.dataQuality.completenessScore < 50) {
        impact += 8;
    }
    if (profile.dataQuality.missingPriceCount >= 10) {
        impact += 5;
    }
    if (profile.dataQuality.unsupportedTransactionCount >= 10) {
        impact += 5;
    }

    impact = cap(impact, 15);

    return {
        code: "MISSING_DATA",
        impact,
        description: `Data completeness is ${Math.round(profile.dataQuality.completenessScore)}% with ${profile.dataQuality.missingPriceCount} missing price points and ${profile.dataQuality.unsupportedTransactionCount} unsupported transactions.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_missing_data",
                "METRIC_THRESHOLD",
                "Missing data reduces reliability",
                `Completeness ${Math.round(profile.dataQuality.completenessScore)}%, missing prices ${profile.dataQuality.missingPriceCount}, unsupported transactions ${profile.dataQuality.unsupportedTransactionCount}.`,
                profile.dataQuality.completenessScore,
                70,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

export function evaluateRiskCategories(profile: WalletBehaviorProfile, events?: NormalizedWalletEvent[]): RiskRuleResult[] {
    return [
        evaluateHighFrequencyActivity(profile, events),
        evaluateShortHoldingPeriod(profile, events),
        evaluateNegativePnl(profile, events),
        evaluateLowWinRate(profile, events),
        evaluateHighTokenDiversity(profile, events),
        evaluatePortfolioConcentration(profile),
        evaluateWashTradingSuspicion(profile),
        evaluateMissingData(profile),
    ];
}

export function personaRiskAdjustment(profile: WalletBehaviorProfile): number {
    switch (profile.persona.primaryPersona) {
        case "BOT_LIKE_TRADER":
            return 12;
        case "HIGH_RISK_SPECULATOR":
            return 10;
        case "WASH_TRADING_SUSPECT":
            return 20;
        case "MEMECOIN_TRADER":
            return 8;
        case "SMART_MONEY_LIKE":
            return -8;
        case "LONG_TERM_HOLDER":
            return -5;
        default:
            return 0;
    }
}

export function buildRiskExplanation(params: {
    riskLevel: WalletRiskProfile["riskLevel"];
    factors: RiskFactor[];
    dataQualityScore: number;
}): string {
    const ordered = [...params.factors].sort((left, right) => right.scoreImpact - left.scoreImpact).slice(0, 3);
    const topDescriptions = ordered.map((factor) => factor.description.toLowerCase());

    if (params.riskLevel === "UNKNOWN") {
        return "Risk level is UNKNOWN because the analysis window contains too few transactions to make a reliable assessment.";
    }

    if (params.riskLevel === "LOW") {
        return "The wallet currently shows LOW risk based on the analyzed window. No major high-frequency, short-term trading, negative PnL, or wash trading signals were detected.";
    }

    const caution = params.dataQualityScore < 70
        ? " The score should be interpreted cautiously because some data may be incomplete."
        : "";

    const joined = topDescriptions.length > 0 ? topDescriptions.join(", ") : "the analyzed metrics";
    return `The wallet is classified as ${params.riskLevel} risk mainly due to ${joined}.${caution}`;
}

export function evaluateWalletRisk(context: RiskRuleContext): RiskEvaluation {
    const { profile, events } = context;
    const categoryResults = evaluateRiskCategories(profile, events);
    const factors: RiskFactor[] = [];
    const evidence: EvidenceBundle[] = [];
    const topFactorDescriptions: string[] = [];
    let rawScore = 0;

    for (const result of categoryResults) {
        rawScore += result.impact;
        if (result.impact > 0 && result.evidence != null) {
            const evidenceIds = result.relatedEvidenceIds != null
                ? [...new Set([result.evidence.id, ...result.relatedEvidenceIds])]
                : [result.evidence.id];

            evidence.push(result.evidence);
            factors.push({
                code: result.code,
                severity: severityFromImpact(result.impact),
                scoreImpact: result.impact,
                description: result.description,
                evidenceIds,
            });
            topFactorDescriptions.push(result.description);
        }
    }

    rawScore += personaRiskAdjustment(profile);

    const riskScore = clamp(Math.round(rawScore), 0, 100);
    const trustScore = clamp(100 - riskScore, 0, 100);
    const riskLevel: WalletRiskProfile["riskLevel"] = profile.analysisWindow.actualTransactionCount < 10
        ? "UNKNOWN"
        : riskScore < 20
            ? "LOW"
            : riskScore < 45
                ? "MEDIUM"
                : riskScore < 75
                    ? "HIGH"
                    : "CRITICAL";

    const risk: WalletRiskProfile = {
        riskScore,
        trustScore,
        riskLevel,
        riskFactors: factors,
        explanation: buildRiskExplanation({
            riskLevel,
            factors,
            dataQualityScore: profile.dataQuality.completenessScore,
        }),
    };

    return {
        risk,
        evidence,
        factors,
        topFactorDescriptions,
    };
}