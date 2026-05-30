import type { EvidenceBundle } from "../types/walletBehaviorProfile";

export function dedupeEvidenceBundles(bundles: EvidenceBundle[]): EvidenceBundle[] {
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
