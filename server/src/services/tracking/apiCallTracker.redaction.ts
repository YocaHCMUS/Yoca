import {
    API_CALL_TRACKER_MAX_RESPONSE_BYTES,
    API_CALL_TRACKER_REDACT_FIELDS,
} from "@sv/config/constants.js";

const REDACTION_MASK = "[REDACTED]";

function isObjectLike(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function shouldRedactKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return API_CALL_TRACKER_REDACT_FIELDS.some((field) => normalized.includes(field));
}

function toSanitizedValue(value: unknown, depth: number): unknown {
    if (depth > 8) {
        return "[MAX_DEPTH_REACHED]";
    }

    if (Array.isArray(value)) {
        return value.map((item) => toSanitizedValue(item, depth + 1));
    }

    if (isObjectLike(value)) {
        const next: Record<string, unknown> = {};
        for (const [key, child] of Object.entries(value)) {
            next[key] = shouldRedactKey(key) ? REDACTION_MASK : toSanitizedValue(child, depth + 1);
        }
        return next;
    }

    return value;
}

export function redactSensitiveFields(value: unknown): unknown {
    return toSanitizedValue(value, 0);
}

export function sanitizeHeaders(input: RequestInit["headers"] | undefined): Record<string, string> {
    if (!input) {
        return {};
    }

    const headers = new Headers(input);
    const out: Record<string, string> = {};

    headers.forEach((value, key) => {
        out[key] = shouldRedactKey(key) ? REDACTION_MASK : value;
    });

    return out;
}

function truncateToByteLimit(raw: string, maxBytes: number): { value: string; truncated: boolean } {
    if (Buffer.byteLength(raw, "utf8") <= maxBytes) {
        return { value: raw, truncated: false };
    }

    let end = Math.max(0, Math.floor(maxBytes / 2));
    while (end > 0 && Buffer.byteLength(raw.slice(0, end), "utf8") > maxBytes) {
        end -= 1;
    }

    return {
        value: raw.slice(0, end),
        truncated: true,
    };
}

export async function parseAndCapResponseData(response: Response): Promise<{ data: unknown; truncated: boolean }> {
    const text = await response.text();
    const { value, truncated } = truncateToByteLimit(text, API_CALL_TRACKER_MAX_RESPONSE_BYTES);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

    if (contentType.includes("application/json")) {
        try {
            const parsed = JSON.parse(value);
            return {
                data: redactSensitiveFields(parsed),
                truncated,
            };
        } catch {
            return {
                data: value,
                truncated,
            };
        }
    }

    return {
        data: value,
        truncated,
    };
}

export function toBodyPreview(body: unknown): unknown {
    if (body == null) {
        return undefined;
    }

    if (typeof body === "string") {
        const { value, truncated } = truncateToByteLimit(body, API_CALL_TRACKER_MAX_RESPONSE_BYTES);
        return truncated ? `${value}...[TRUNCATED]` : value;
    }

    return redactSensitiveFields(body);
}
