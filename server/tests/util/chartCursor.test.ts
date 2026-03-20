import { describe, expect, it } from "vitest";
import {
    ChartCursorDecodeError,
    decodeChartCursor,
    encodeChartCursor,
} from "../../src/util/chartCursor.js";

describe("chartCursor", () => {
    it("round-trips encoded payloads", () => {
        const encoded = encodeChartCursor({
            endpoint: "balance",
            requestedFromSec: 100,
            requestedToSec: 200,
            heliusCursor: "sig-123",
            currentChunkFromSec: 150,
            currentChunkToSec: 200,
            aggregationHint: "daily",
            lastProcessedSignature: "sig-999",
        });

        const decoded = decodeChartCursor(encoded, "balance");
        expect(decoded.endpoint).toBe("balance");
        expect(decoded.requestedFromSec).toBe(100);
        expect(decoded.requestedToSec).toBe(200);
        expect(decoded.heliusCursor).toBe("sig-123");
        expect(decoded.currentChunkFromSec).toBe(150);
        expect(decoded.currentChunkToSec).toBe(200);
        expect(decoded.aggregationHint).toBe("daily");
        expect(decoded.lastProcessedSignature).toBe("sig-999");
    });

    it("rejects malformed cursor payload", () => {
        expect(() => decodeChartCursor("not-a-valid-cursor", "balance"))
            .toThrow(ChartCursorDecodeError);
    });

    it("rejects endpoint mismatch", () => {
        const encoded = encodeChartCursor({
            endpoint: "pnl",
            requestedFromSec: 10,
            requestedToSec: 20,
            heliusCursor: null,
            currentChunkFromSec: 15,
            currentChunkToSec: 20,
            aggregationHint: "weekly",
            lastProcessedSignature: null,
        });

        expect(() => decodeChartCursor(encoded, "balance")).toThrowError(
            /endpoint mismatch/i,
        );
    });
});
