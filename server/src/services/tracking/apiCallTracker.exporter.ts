import {
    API_CALL_TRACKER_ENABLED,
    API_CALL_TRACKER_EXPORT_DIR,
} from "@sv/config/constants.js";
import type { ApiCallRecord } from "@sv/services/tracking/apiCallTracker.types.js";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

const queue: ApiCallRecord[] = [];
let flushInFlight: Promise<void> | null = null;
let hooksRegistered = false;

function getDateStamp(now: Date): string {
    return now.toISOString().slice(0, 10);
}

function getBaseDir(): string {
    return path.resolve(process.cwd(), API_CALL_TRACKER_EXPORT_DIR);
}

function getFilePath(record: ApiCallRecord): string {
    const dateStamp = getDateStamp(new Date(record.timestampStartMs));
    const fileName = record.error
        ? `api-tracker-errors-${dateStamp}.jsonl`
        : `api-tracker-${dateStamp}.jsonl`;
    return path.join(getBaseDir(), fileName);
}

async function flushQueueInternal(records: ApiCallRecord[]): Promise<void> {
    if (records.length === 0) {
        return;
    }

    const byFile = new Map<string, string[]>();

    for (const record of records) {
        const filePath = getFilePath(record);
        const lines = byFile.get(filePath) ?? [];
        lines.push(JSON.stringify(record));
        byFile.set(filePath, lines);
    }

    await mkdir(getBaseDir(), { recursive: true });

    for (const [filePath, lines] of byFile.entries()) {
        await appendFile(filePath, `${lines.join("\n")}\n`, "utf8");
    }
}

export async function flushApiTrackerRecords(): Promise<void> {
    if (!API_CALL_TRACKER_ENABLED || queue.length === 0) {
        return;
    }

    const pending = queue.splice(0, queue.length);
    await flushQueueInternal(pending);
}

function ensureProcessHooks(): void {
    if (hooksRegistered) {
        return;
    }

    hooksRegistered = true;

    const flushSafe = () => {
        void flushApiTrackerRecords().catch((error) => {
            console.error("[api-tracker] flush failed", error);
        });
    };

    process.on("beforeExit", flushSafe);
    process.on("SIGINT", async () => {
        try {
            await flushApiTrackerRecords();
        } catch (error) {
            console.error("[api-tracker] SIGINT flush failed", error);
        }
        process.exit(0);
    });
    process.on("SIGTERM", async () => {
        try {
            await flushApiTrackerRecords();
        } catch (error) {
            console.error("[api-tracker] SIGTERM flush failed", error);
        }
        process.exit(0);
    });
}

setInterval(() => {
    if (!API_CALL_TRACKER_ENABLED || queue.length === 0) {
        return;
    }

    if (!flushInFlight) {
        flushInFlight = flushApiTrackerRecords()
            .catch((error) => {
                console.error("[api-tracker] periodic flush failed", error);
            })
            .finally(() => {
                flushInFlight = null;
            });
    }
}, 2000).unref();

export function queueApiTrackerRecord(record: ApiCallRecord): void {
    if (!API_CALL_TRACKER_ENABLED) {
        return;
    }

    ensureProcessHooks();
    queue.push(record);
}
