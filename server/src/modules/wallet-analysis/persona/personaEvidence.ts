import type { EvidenceBundle, WalletPersonaType } from "../types/walletBehaviorProfile";
import type { PersonaRuleResult } from "./personaRules";

export function uniqueEvidenceBundles(bundles: EvidenceBundle[]): EvidenceBundle[] {
    const seen = new Set<string>();
    const unique: EvidenceBundle[] = [];

    for (const bundle of bundles) {
        if (seen.has(bundle.id)) {
            continue;
        }

        seen.add(bundle.id);
        unique.push(bundle);
    }

    return unique;
}

export function evidenceIdsForPersona(results: PersonaRuleResult[], persona: WalletPersonaType): string[] {
    const result = results.find((entry) => entry.persona === persona);
    if (result == null) {
        return [];
    }

    return result.evidence.map((bundle) => bundle.id);
}

export function selectTopReasoning(results: PersonaRuleResult[], limit: number): string[] {
    const reasoning = results.flatMap((result) => result.reasoning);
    return uniqueStrings(reasoning).slice(0, limit);
}

export function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}