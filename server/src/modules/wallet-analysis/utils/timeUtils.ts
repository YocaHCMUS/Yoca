import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";

function toTimeValue(timestamp: string): number {
    return Date.parse(timestamp);
}

export function sortEventsByTimestampAsc(events: NormalizedWalletEvent[]): NormalizedWalletEvent[] {
    return [...events].sort((left, right) => toTimeValue(left.timestamp) - toTimeValue(right.timestamp));
}

export function getUtcDateKey(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 10);
}

export function getUtcHourKey(timestamp: string): string {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 13);
}

export function diffSeconds(startIso: string, endIso: string): number {
    return (toTimeValue(endIso) - toTimeValue(startIso)) / 1000;
}

export function diffHours(startIso: string, endIso: string): number {
    return diffSeconds(startIso, endIso) / 3600;
}