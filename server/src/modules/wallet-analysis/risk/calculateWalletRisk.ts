import type { EvidenceBundle, WalletBehaviorProfile, WalletRiskProfile } from "../types/walletBehaviorProfile";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import { evaluateWalletRisk } from "./riskRules";

export function calculateWalletRisk(params: {
    profile: WalletBehaviorProfile;
    events?: NormalizedWalletEvent[];
}): {
    risk: WalletRiskProfile;
    evidence: EvidenceBundle[];
} {
    const evaluation = evaluateWalletRisk({
        profile: params.profile,
        events: params.events,
    });

    return {
        risk: evaluation.risk,
        evidence: evaluation.evidence,
    };
}