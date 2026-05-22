import { WalletBehaviorProfileSchema } from "../schemas/walletBehaviorProfile.schema";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { WalletBehaviorProfile } from "../types/walletBehaviorProfile";
import { calculateWalletRisk } from "../risk/calculateWalletRisk";
import { uniqueEvidenceBundles } from "../risk/riskEvidence";

export function enrichProfileWithRisk(params: {
    profile: WalletBehaviorProfile;
    events?: NormalizedWalletEvent[];
}): WalletBehaviorProfile {
    const riskResult = calculateWalletRisk({
        profile: params.profile,
        events: params.events,
    });

    const topDescriptions = riskResult.risk.riskFactors
        .slice()
        .sort((left, right) => right.scoreImpact - left.scoreImpact)
        .slice(0, 2)
        .map((factor) => factor.description);

    const updatedProfile: WalletBehaviorProfile = {
        ...params.profile,
        risk: riskResult.risk,
        evidence: uniqueEvidenceBundles([...params.profile.evidence, ...riskResult.evidence]),
        aiContext: {
            ...params.profile.aiContext,
            summaryFacts: [
                ...params.profile.aiContext.summaryFacts,
                `Risk score: ${riskResult.risk.riskScore}/100`,
                `Trust score: ${riskResult.risk.trustScore}/100`,
                `Risk level: ${riskResult.risk.riskLevel}`,
                ...topDescriptions,
            ],
        },
    };

    return WalletBehaviorProfileSchema.parse(updatedProfile);
}