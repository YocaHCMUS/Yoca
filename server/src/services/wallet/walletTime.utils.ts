import type {
    WalletRangeOptions,
    WalletTimePeriodInput,
    WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import { DAY_SEC } from "@sv/services/wallet/wallet.constants.js";

export type WalletHistoryRange = {
    fromSec: number;
    toSec: number;
};

export function normalizeCursorValue(value?: string): string | undefined {
    const normalized = String(value ?? "").trim();
    return normalized.length > 0 ? normalized : undefined;
}

export function getTimestampSecFromIso(iso: string): number {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) {
        return 0;
    }
    return Math.floor(ms / 1000);
}

export function parseTimestampMs(timestamp: string): number {
    const ms = Date.parse(timestamp);
    return Number.isNaN(ms) ? 0 : ms;
}

export function getHistoryRange(options?: WalletRangeOptions): WalletHistoryRange {
    const nowSec = Math.floor(Date.now() / 1000);

    if (options?.fromSec != null || options?.toSec != null) {
        const fromSec = options?.fromSec != null ? Math.max(0, options.fromSec) : nowSec - 7 * DAY_SEC;
        const toSec = options?.toSec != null ? Math.max(fromSec, options.toSec) : nowSec;
        return { fromSec, toSec };
    }

    const fromPeriod = options?.from;
    const normalizedPeriod = normalizeShortHistoryPeriod(fromPeriod);
    const fromSec = normalizedPeriod === "24H" ? nowSec - DAY_SEC : nowSec - 7 * DAY_SEC;
    return { fromSec, toSec: nowSec };
}

function normalizeShortHistoryPeriod(value?: WalletTimePeriodInput): "24H" | "7D" {
    const normalized = String(value ?? "").trim().toUpperCase();
    return normalized === "24H" ? "24H" : "7D";
}

/**
 * Map a wallet time period to Birdeye fetch parameters (count and loop iterations)
 * @param timePeriod - wallet time period (7D, 30D, 60D, 90D, 1Y, All, 24H)
 * @returns object with count (points per request) and loop (number of iterations)
 */
export function timePeriodToCountAndLoop(timePeriod: WalletTimePeriod): { count: number; loop: number } {
    switch (timePeriod) {
        case "24H":
            return { count: 1, loop: 1 };
        case "7D":
            return { count: 7, loop: 1 };
        case "30D":
            return { count: 30, loop: 1 };
        case "60D":
            return { count: 30, loop: 2 };
        case "90D":
            return { count: 30, loop: 3 };
        case "1Y":
            return { count: 30, loop: 12 };
        case "All":
            return { count: 30, loop: 12 };
        default:
            return { count: 30, loop: 1 };
    }
}
