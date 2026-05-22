import type { EvidenceBundle, WalletBehaviorProfile, WalletRiskProfile } from "../types/walletBehaviorProfile";
import { evaluateWalletRisk } from "./riskRules";

export function calculateWalletRisk(params: {
    profile: WalletBehaviorProfile;
}): {
    risk: WalletRiskProfile;
    evidence: EvidenceBundle[];
} {
    const evaluation = evaluateWalletRisk(params.profile);

    return {
        risk: evaluation.risk,
        evidence: evaluation.evidence,
    };
}