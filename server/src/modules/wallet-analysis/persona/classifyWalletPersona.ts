import type { EvidenceBundle, WalletBehaviorProfile, WalletPersonaProfile, WalletPersonaType } from "../types/walletBehaviorProfile";
import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import { clamp } from "../utils/mathUtils";
import { normalizePersonaScores, scorePersonaRules, selectPersonaPrimary, totalAirdropClaimCount, totalNftSignalCount, totalTokenTransferInCount, type PersonaScoreMap } from "./personaRules";
import { evidenceIdsForPersona, selectTopReasoning, uniqueEvidenceBundles, uniqueStrings } from "./personaEvidence";

function buildCounts(events: NormalizedWalletEvent[]): {
    nftEventCount: number;
    airdropClaimCount: number;
    tokenTransferInCount: number;
} {
    return {
        nftEventCount: totalNftSignalCount(events),
        airdropClaimCount: totalAirdropClaimCount(events),
        tokenTransferInCount: totalTokenTransferInCount(events),
    };
}

function normalizeConfidence(params: {
    profile: WalletBehaviorProfile;
    primaryPersona: WalletPersonaType;
    primaryScore: number;
    secondaryScore: number;
}): number {
    const scoreGap = params.primaryScore - params.secondaryScore;
    let confidence = 0.35
        + (params.primaryScore / 100) * 0.35
        + (scoreGap / 100) * 0.15
        + (params.profile.dataQuality.completenessScore / 100) * 0.15;

    if (params.profile.analysisWindow.actualTransactionCount < 20) {
        confidence -= 0.2;
    }
    if (params.profile.dataQuality.completenessScore < 50) {
        confidence -= 0.15;
    }
    if (params.primaryPersona === "UNKNOWN") {
        confidence = 0;
    }

    return clamp(confidence, 0, 1);
}

export function classifyWalletPersona(params: {
    profile: WalletBehaviorProfile;
    events?: NormalizedWalletEvent[];
}): {
    persona: WalletPersonaProfile;
    evidence: EvidenceBundle[];
} {
    const events = params.events ?? [];
    const counts = buildCounts(events);
    const scoring = scorePersonaRules({
        profile: params.profile,
        events,
        counts,
    });

    const normalizedScores: PersonaScoreMap = normalizePersonaScores(scoring.scores);
    const allowedPrimary = Object.fromEntries(scoring.results.map((result) => [result.persona, result.allowAsPrimary])) as Record<WalletPersonaType, boolean>;
    const primaryCandidate = selectPersonaPrimary(normalizedScores, allowedPrimary);

    const topNonUnknownScore = Math.max(...Object.entries(normalizedScores)
        .filter(([persona]) => persona !== "UNKNOWN")
        .map(([, score]) => score));

    let primaryPersona: WalletPersonaType = primaryCandidate;
    let secondaryPersonas: WalletPersonaType[] = [];
    let confidence = 0;

    if (!Number.isFinite(topNonUnknownScore) || topNonUnknownScore < 25) {
        primaryPersona = "UNKNOWN";
        secondaryPersonas = [];
    } else {
        const orderedCandidates = [...scoring.results]
            .filter((result) => result.persona !== "UNKNOWN" && result.allowAsPrimary)
            .sort((left, right) => normalizedScores[right.persona] - normalizedScores[left.persona]);

        primaryPersona = orderedCandidates[0]?.persona ?? "UNKNOWN";
        secondaryPersonas = orderedCandidates
            .filter((result) => result.persona !== primaryPersona && normalizedScores[result.persona] >= 50)
            .slice(0, 3)
            .map((result) => result.persona);

        const secondScore = orderedCandidates[1] != null ? normalizedScores[orderedCandidates[1].persona] : 0;
        confidence = normalizeConfidence({
            profile: params.profile,
            primaryPersona,
            primaryScore: normalizedScores[primaryPersona],
            secondaryScore: secondScore,
        });
    }

    if (primaryPersona === "UNKNOWN") {
        confidence = 0;
    }

    const selectedReasoning = uniqueStrings([
        ...selectTopReasoning(scoring.results.filter((result) => result.persona === primaryPersona), 3),
        ...secondaryPersonas.flatMap((persona) => selectTopReasoning(scoring.results.filter((result) => result.persona === persona), 1)),
    ]).slice(0, 5);

    const evidence = uniqueEvidenceBundles(scoring.evidence);
    const supportingEvidenceIds = uniqueStrings([
        ...evidenceIdsForPersona(scoring.results, primaryPersona),
        ...secondaryPersonas.flatMap((persona) => evidenceIdsForPersona(scoring.results, persona)),
    ]);

    const persona: WalletPersonaProfile = {
        primaryPersona,
        secondaryPersonas,
        confidence,
        personaScores: normalizedScores,
        reasoning: selectedReasoning,
        evidenceIds: supportingEvidenceIds,
    };

    return {
        persona,
        evidence,
    };
}
