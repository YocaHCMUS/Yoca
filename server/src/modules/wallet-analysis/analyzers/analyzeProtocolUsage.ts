import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { ProtocolUsageProfile } from "../types/walletBehaviorProfile";
import { safeDivide, sum } from "../utils/mathUtils";

export function analyzeProtocolUsage(events: NormalizedWalletEvent[]): ProtocolUsageProfile {
    if (events.length === 0) {
        return {
            protocols: [],
            dominantProtocol: null,
            dexUsageRatio: null,
            lendingUsageRatio: null,
            nftMarketplaceUsageRatio: null,
            stakingUsageRatio: null,
        };
    }

    const groups = new Map<string, NormalizedWalletEvent[]>();

    for (const event of events) {
        const protocolName = event.protocol?.name ?? "Unknown";
        const existing = groups.get(protocolName) ?? [];
        existing.push(event);
        groups.set(protocolName, existing);
    }

    const protocols = [...groups.entries()].map(([protocolName, groupedEvents]) => {
        const rawCategory = groupedEvents[0]?.protocol?.category ?? "UNKNOWN";
        const category = rawCategory === "SYSTEM" ? "UNKNOWN" : rawCategory;
        const transactionCount = groupedEvents.length;
        const knownVolumes = groupedEvents
            .map((event) => event.swap?.estimatedSwapValueUsd ?? event.swap?.inputValueUsd ?? event.swap?.outputValueUsd ?? null)
            .filter((value): value is number => value != null);

        return {
            protocolName,
            category,
            transactionCount,
            volumeUsd: knownVolumes.length > 0 ? sum(knownVolumes) : null,
            usageRatio: safeDivide(transactionCount, events.length),
        };
    });

    const dominantProtocol = protocols.length > 0
        ? [...protocols].sort((left, right) => right.transactionCount - left.transactionCount)[0]?.protocolName ?? null
        : null;

    const countByCategory = (category: string): number =>
        events.filter((event) => (event.protocol?.category ?? "UNKNOWN") === category).length;

    return {
        protocols,
        dominantProtocol,
        dexUsageRatio: safeDivide(countByCategory("DEX"), events.length),
        lendingUsageRatio: safeDivide(countByCategory("LENDING"), events.length),
        nftMarketplaceUsageRatio: safeDivide(countByCategory("NFT_MARKETPLACE"), events.length),
        stakingUsageRatio: safeDivide(countByCategory("STAKING"), events.length),
    };
}