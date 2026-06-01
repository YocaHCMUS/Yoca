import { WalletBehaviorProfileSchema } from "../schemas/walletBehaviorProfile.schema";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { WalletBehaviorProfile } from "../types/walletBehaviorProfile";
import { classifyWalletPersona } from "../persona/classifyWalletPersona";
import { uniqueEvidenceBundles, uniqueStrings } from "../persona/personaEvidence";

export function enrichProfileWithPersona(params: {
    profile: WalletBehaviorProfile;
    events?: NormalizedWalletEvent[];
}): WalletBehaviorProfile {
    const classification = classifyWalletPersona({
        profile: params.profile,
        events: params.events,
    });

    const topReasoning = classification.persona.reasoning.slice(0, 3);
    const updatedProfile: WalletBehaviorProfile = {
        ...params.profile,
        persona: classification.persona,
        evidence: uniqueEvidenceBundles([...params.profile.evidence, ...classification.evidence]),
        aiContext: {
            ...params.profile.aiContext,
            summaryFacts: uniqueStrings([
                ...params.profile.aiContext.summaryFacts,
                `Primary persona: ${classification.persona.primaryPersona}`,
                `Persona confidence: ${Math.round(classification.persona.confidence * 100)}%`,
                ...topReasoning,
            ]),
        },
    };

    return WalletBehaviorProfileSchema.parse(updatedProfile);
}