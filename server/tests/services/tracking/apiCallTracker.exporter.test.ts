import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";

vi.mock("@sv/config/constants.js", () => ({
    API_CALL_TRACKER_ENABLED: true,
    API_CALL_TRACKER_EXPORT_DIR: "server/tests/.tmp-api-tracker",
}));

const OUTPUT_DIR = path.resolve(process.cwd(), "server/tests/.tmp-api-tracker");

describe("apiCallTracker.exporter", () => {
    beforeEach(async () => {
        await rm(OUTPUT_DIR, { recursive: true, force: true });
        await mkdir(OUTPUT_DIR, { recursive: true });
        vi.resetModules();
    });

    afterEach(async () => {
        await rm(OUTPUT_DIR, { recursive: true, force: true });
    });

    it("writes queued records to daily jsonl files and separates error records", async () => {
        const {
            queueApiTrackerRecord,
            flushApiTrackerRecords,
        } = await import("../../../src/services/tracking/apiCallTracker.exporter.ts");

        const ts = Date.parse("2026-03-24T12:00:00.000Z");

        queueApiTrackerRecord({
            id: "ok-1",
            timestampStartMs: ts,
            timestampEndMs: ts + 5,
            durationMs: 5,
            provider: "birdeye",
            request: {
                url: "https://public-api.birdeye.so/defi/v3/txs/recent",
                method: "GET",
                headers: {},
                bodyPreview: null,
            },
            apiKey: null,
            origin: {
                route: "/api/trades",
                serviceFile: "server/src/services/trades.ts",
                functionName: "fetchRecentTrades",
                firstCaller: "server/src/routes/trades.ts:get",
                requestId: "req-1",
            },
            response: {
                status: 200,
                ok: true,
                headers: {},
                data: { ok: true },
                truncated: false,
            },
        });

        queueApiTrackerRecord({
            id: "err-1",
            timestampStartMs: ts,
            timestampEndMs: ts + 8,
            durationMs: 8,
            provider: "bitquery",
            request: {
                url: "https://streaming.bitquery.io/graphql",
                method: "POST",
                headers: {},
                bodyPreview: null,
            },
            apiKey: null,
            origin: {
                route: "/api/transfers",
                serviceFile: "server/src/services/transfers.ts",
                functionName: "fetchLatestTransfers",
                firstCaller: "server/src/routes/transfers.ts:get",
                requestId: "req-2",
            },
            response: {
                status: 0,
                ok: false,
                headers: {},
                data: null,
                truncated: false,
            },
            error: {
                message: "boom",
                name: "Error",
            },
        });

        await flushApiTrackerRecords();

        const normalFile = path.join(OUTPUT_DIR, "api-tracker-2026-03-24.jsonl");
        const errorFile = path.join(OUTPUT_DIR, "api-tracker-errors-2026-03-24.jsonl");

        const normalStats = await stat(normalFile);
        const errorStats = await stat(errorFile);

        expect(normalStats.isFile()).toBe(true);
        expect(errorStats.isFile()).toBe(true);

        const normalLines = (await readFile(normalFile, "utf8")).trim().split("\n");
        const errorLines = (await readFile(errorFile, "utf8")).trim().split("\n");

        expect(normalLines).toHaveLength(1);
        expect(errorLines).toHaveLength(1);

        const normal = JSON.parse(normalLines[0]);
        const error = JSON.parse(errorLines[0]);

        expect(normal.id).toBe("ok-1");
        expect(error.id).toBe("err-1");
        expect(error.error.message).toBe("boom");
    });
});
