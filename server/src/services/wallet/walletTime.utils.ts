import type {
    WalletRangeOptions,
    WalletTimePeriodInput,
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
