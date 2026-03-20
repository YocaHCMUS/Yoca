export type ChartCursorEndpoint = "balance" | "pnl";

export interface ChartCursorPayload {
    v: 1;
    endpoint: ChartCursorEndpoint;
    requestedFromSec: number;
    requestedToSec: number;
    heliusCursor: string | null;
    currentChunkFromSec: number;
    currentChunkToSec: number;
    aggregationHint?: string;
    lastProcessedSignature?: string | null;
}

const CURSOR_VERSION = 1;

export class ChartCursorDecodeError extends Error {
    readonly code: "invalid_cursor" | "endpoint_mismatch";

    constructor(
        code: "invalid_cursor" | "endpoint_mismatch",
        message: string,
    ) {
        super(message);
        this.name = "ChartCursorDecodeError";
        this.code = code;
    }
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value);
}

function normalizeOptionalString(value: unknown): string | null {
    if (value == null) {
        return null;
    }

    const normalized = String(value).trim();
    return normalized.length > 0 ? normalized : null;
}

function toPayload(value: unknown): ChartCursorPayload | null {
    if (value == null || typeof value !== "object") {
        return null;
    }

    const raw = value as Record<string, unknown>;
    if (raw.v !== CURSOR_VERSION) {
        return null;
    }

    const endpoint = raw.endpoint;
    if (endpoint !== "balance" && endpoint !== "pnl") {
        return null;
    }

    const requestedFromSec = Number(raw.requestedFromSec);
    const requestedToSec = Number(raw.requestedToSec);
    const currentChunkFromSec = Number(raw.currentChunkFromSec);
    const currentChunkToSec = Number(raw.currentChunkToSec);

    if (
        !isFiniteNumber(requestedFromSec) ||
        !isFiniteNumber(requestedToSec) ||
        !isFiniteNumber(currentChunkFromSec) ||
        !isFiniteNumber(currentChunkToSec)
    ) {
        return null;
    }

    return {
        v: CURSOR_VERSION,
        endpoint,
        requestedFromSec,
        requestedToSec,
        heliusCursor: normalizeOptionalString(raw.heliusCursor),
        currentChunkFromSec,
        currentChunkToSec,
        aggregationHint:
            raw.aggregationHint == null ? undefined : String(raw.aggregationHint),
        lastProcessedSignature: normalizeOptionalString(raw.lastProcessedSignature),
    };
}

/**
 * PURPOSE: Encode chart chunk pagination state into an opaque token.
 * USAGE:
 * const token = encodeChartCursor({ endpoint: "balance", ...payload });
 */
export function encodeChartCursor(
    payload: Omit<ChartCursorPayload, "v"> & { v?: 1 },
): string {
    const normalizedPayload: ChartCursorPayload = {
        ...payload,
        v: CURSOR_VERSION,
    };

    return Buffer.from(JSON.stringify(normalizedPayload), "utf8").toString(
        "base64url",
    );
}

/**
 * PURPOSE: Decode and validate a chart cursor token.
 * USAGE:
 * const payload = decodeChartCursor(cursor, "pnl");
 */
export function decodeChartCursor(
    cursor: string,
    expectedEndpoint?: ChartCursorEndpoint,
): ChartCursorPayload {
    const normalizedCursor = String(cursor ?? "").trim();
    if (!normalizedCursor) {
        throw new ChartCursorDecodeError("invalid_cursor", "Cursor is required");
    }

    let parsed: unknown;
    try {
        const decoded = Buffer.from(normalizedCursor, "base64url").toString("utf8");
        parsed = JSON.parse(decoded);
    } catch {
        throw new ChartCursorDecodeError("invalid_cursor", "Cursor is malformed");
    }

    const payload = toPayload(parsed);
    if (!payload) {
        throw new ChartCursorDecodeError("invalid_cursor", "Cursor payload is invalid");
    }

    if (expectedEndpoint && payload.endpoint !== expectedEndpoint) {
        throw new ChartCursorDecodeError(
            "endpoint_mismatch",
            `Cursor endpoint mismatch: expected ${expectedEndpoint}`,
        );
    }

    return payload;
}
