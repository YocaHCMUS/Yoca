import type { EvidenceBundle, RiskFactor, WalletBehaviorProfile, WalletRiskProfile } from "../types/walletBehaviorProfile";
import { clamp } from "../utils/mathUtils";

export type RiskRuleContext = {
    profile: WalletBehaviorProfile;
};

export type RiskRuleResult = {
    code: RiskFactor["code"];
    impact: number;
    evidence?: EvidenceBundle;
    description: string;
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
): EvidenceBundle {
    return {
        id,
        type,
        title,
        description,
        value,
        threshold,
        severity,
    };
}

function cap(impact: number, limit: number): number {
    return Math.max(0, Math.min(impact, limit));
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

function evaluateHighFrequencyActivity(profile: WalletBehaviorProfile): RiskRuleResult {
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

    return {
        code: "HIGH_FREQUENCY_ACTIVITY",
        impact,
        description: `Activity is concentrated with a ${profile.activity.activityLevel.toLowerCase()} activity level and a burst score of ${Math.round(profile.activity.burstActivityScore)}.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_high_frequency_activity",
                "METRIC_THRESHOLD",
                "High frequency activity",
                `Activity level ${profile.activity.activityLevel}, burst score ${Math.round(profile.activity.burstActivityScore)}, max transactions in one hour ${profile.activity.maxTransactionsInOneHour}.`,
                profile.activity.burstActivityScore,
                70,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateShortHoldingPeriod(profile: WalletBehaviorProfile): RiskRuleResult {
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

    return {
        code: "SHORT_HOLDING_PERIOD",
        impact,
        description: profile.trading.shortTermTradeRatio != null
            ? `Short-term trade ratio is ${Math.round(profile.trading.shortTermTradeRatio * 100)}% with a median holding period of ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours.`
            : `Median holding period is ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_short_holding",
                "METRIC_THRESHOLD",
                "Short holding period risk",
                `Short-term trade ratio ${profile.trading.shortTermTradeRatio ?? "unknown"}, median holding period ${profile.trading.medianHoldingPeriodHours ?? "unknown"} hours, trading style ${profile.trading.tradingStyle}.`,
                profile.trading.shortTermTradeRatio ?? null,
                0.5,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateNegativePnl(profile: WalletBehaviorProfile): RiskRuleResult {
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

    return {
        code: "NEGATIVE_PNL",
        impact,
        description: profile.pnl.realizedPnlUsd != null
            ? `Realized PnL is ${profile.pnl.realizedPnlUsd.toFixed(2)} USD.`
            : "Realized PnL is unavailable.",
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_negative_pnl",
                "PNL_RESULT",
                "Negative realized PnL",
                `Realized PnL is ${profile.pnl.realizedPnlUsd?.toFixed(2) ?? "unknown"} USD.`,
                profile.pnl.realizedPnlUsd ?? null,
                0,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateLowWinRate(profile: WalletBehaviorProfile): RiskRuleResult {
    let impact = 0;

    if (profile.pnl.closedPositionCount >= 5 && profile.pnl.winRate != null && profile.pnl.winRate < 0.45) {
        impact += 8;
    }
    if (profile.pnl.closedPositionCount >= 10 && profile.pnl.winRate != null && profile.pnl.winRate < 0.35) {
        impact += 6;
    }

    impact = cap(impact, 14);

    return {
        code: "LOW_WIN_RATE",
        impact,
        description: profile.pnl.winRate != null
            ? `Win rate is ${Math.round(profile.pnl.winRate * 100)}% across ${profile.pnl.closedPositionCount} closed positions.`
            : `Win rate is unavailable across ${profile.pnl.closedPositionCount} closed positions.`,
        evidence: impact > 0
            ? createEvidence(
                "ev_risk_low_win_rate",
                "PNL_RESULT",
                "Low win rate",
                `Win rate ${profile.pnl.winRate ?? "unknown"} across ${profile.pnl.closedPositionCount} closed positions.`,
                profile.pnl.winRate ?? null,
                0.45,
                severityFromImpact(impact),
            )
            : undefined,
    };
}

function evaluateHighTokenDiversity(profile: WalletBehaviorProfile): RiskRuleResult {
    let impact = 0;

    if (profile.trading.uniqueTokensTraded >= 20) {
        impact += 8;
    }
    if (profile.trading.uniqueTokensTraded >= 50) {
        impact += 7;
    }

    impact = cap(impact, 15);

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

    return {
        code: "WASH_TRADING_SUSPECTED",
        impact,
        description: `Wash trading suspicion is ${profile.washTrading.suspicionLevel.toLowerCase()} with score ${Math.round(profile.washTrading.suspicionScore)}.`,
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

export function evaluateRiskCategories(profile: WalletBehaviorProfile): RiskRuleResult[] {
    return [
        evaluateHighFrequencyActivity(profile),
        evaluateShortHoldingPeriod(profile),
        evaluateNegativePnl(profile),
        evaluateLowWinRate(profile),
        evaluateHighTokenDiversity(profile),
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

export function evaluateWalletRisk(profile: WalletBehaviorProfile): RiskEvaluation {
    const categoryResults = evaluateRiskCategories(profile);
    const factors: RiskFactor[] = [];
    const evidence: EvidenceBundle[] = [];
    const topFactorDescriptions: string[] = [];
    let rawScore = 0;

    for (const result of categoryResults) {
        rawScore += result.impact;
        if (result.impact > 0 && result.evidence != null) {
            evidence.push(result.evidence);
            factors.push({
                code: result.code,
                severity: severityFromImpact(result.impact),
                scoreImpact: result.impact,
                description: result.description,
                evidenceIds: [result.evidence.id],
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