import type { Context } from "hono";
import type { WalletTimePeriod } from "@sv/services/wallet/walletData.service.js";
import { resolveWalletTimeRangeSec } from "@sv/services/wallet/walletData.service.js";
import {
    ChartCursorDecodeError,
    decodeChartCursor,
} from "@sv/util/chartCursor.js";

export type ParsedChartChunkInput = {
    requestedRange: {
        fromSec: number;
        toSec: number;
    };
    chunkToSec?: number;
    heliusCursor?: string | null;
};

export function parseChartChunkInput(input: {
    c: Context;
    cursor?: string;
    endpoint: "balance" | "pnl";
    timePeriod: WalletTimePeriod;
}):
    | { ok: true; value: ParsedChartChunkInput }
    | { ok: false; response: Response } {
    let cursorPayload: ReturnType<typeof decodeChartCursor> | undefined;

    if (input.cursor) {
        try {
            cursorPayload = decodeChartCursor(input.cursor, input.endpoint);
        } catch (err) {
            if (err instanceof ChartCursorDecodeError) {
                return {
                    ok: false,
                    response: input.c.json(
                        {
                            error: "Validation error",
                            message: err.message,
                        },
                        400,
                    ),
                };
            }

            throw err;
        }
    }

    const requestedRange = cursorPayload
        ? {
            fromSec: cursorPayload.requestedFromSec,
            toSec: cursorPayload.requestedToSec,
        }
        : resolveWalletTimeRangeSec(input.timePeriod);

    return {
        ok: true,
        value: {
            requestedRange,
            chunkToSec: cursorPayload?.currentChunkToSec,
            heliusCursor: cursorPayload?.heliusCursor,
        },
    };
}
