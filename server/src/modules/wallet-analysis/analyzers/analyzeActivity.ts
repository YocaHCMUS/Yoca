import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { WalletActivityProfile } from "../types/walletBehaviorProfile";
import { clamp, median, safeDivide } from "../utils/mathUtils";
import { getUtcDateKey, getUtcHourKey, sortEventsByTimestampAsc } from "../utils/timeUtils";

export function analyzeActivity(events: NormalizedWalletEvent[]): WalletActivityProfile {
    const sortedEvents = sortEventsByTimestampAsc(events);

    if (sortedEvents.length === 0) {
        return {
            activeDays: 0,
            averageTransactionsPerDay: 0,
            firstTransactionAt: null,
            lastTransactionAt: null,
            maxTransactionsInOneHour: 0,
            medianTimeBetweenTransactionsSeconds: null,
            burstActivityScore: 0,
            failedTransactionRatio: 0,
            activityLevel: "LOW",
        };
    }

    const activeDays = new Set(sortedEvents.map((event) => getUtcDateKey(event.timestamp))).size;
    const averageTransactionsPerDay = activeDays > 0 ? sortedEvents.length / activeDays : 0;

    const hourlyCounts = new Map<string, number>();
    for (const event of sortedEvents) {
        const hourKey = getUtcHourKey(event.timestamp);
        hourlyCounts.set(hourKey, (hourlyCounts.get(hourKey) ?? 0) + 1);
    }

    const maxTransactionsInOneHour = Math.max(0, ...hourlyCounts.values());

    const gapsInSeconds: number[] = [];
    for (let index = 1; index < sortedEvents.length; index += 1) {
        gapsInSeconds.push((Date.parse(sortedEvents[index].timestamp) - Date.parse(sortedEvents[index - 1].timestamp)) / 1000);
    }

    const failedTransactionCount = sortedEvents.filter((event) => event.status === "FAILED").length;
    const failedTransactionRatio = safeDivide(failedTransactionCount, sortedEvents.length, 0) ?? 0;

    const burstActivityScore = clamp(
        (maxTransactionsInOneHour / Math.max(1, averageTransactionsPerDay)) * 20,
        0,
        100,
    );

    let activityLevel: WalletActivityProfile["activityLevel"] = "LOW";
    if (averageTransactionsPerDay >= 50 || maxTransactionsInOneHour >= 30) {
        activityLevel = "EXTREME";
    } else if (averageTransactionsPerDay >= 10) {
        activityLevel = "HIGH";
    } else if (averageTransactionsPerDay >= 2) {
        activityLevel = "MEDIUM";
    }

    return {
        activeDays,
        averageTransactionsPerDay,
        firstTransactionAt: sortedEvents[0]?.timestamp ?? null,
        lastTransactionAt: sortedEvents[sortedEvents.length - 1]?.timestamp ?? null,
        maxTransactionsInOneHour,
        medianTimeBetweenTransactionsSeconds: gapsInSeconds.length >= 1 ? median(gapsInSeconds) : null,
        burstActivityScore,
        failedTransactionRatio,
        activityLevel,
    };
}