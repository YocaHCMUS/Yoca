/**
 * P&L Chart API Route
 *
 * Endpoint for fetching profit and loss data.
 * Supports chunked backfill via cursor + limit.
 *
 * @module routes/charts/pnl.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { getHistoricalPnLData } from "@sv/services/charts/pnlChart.service.js";
import { type WalletTimePeriod } from "@sv/services/wallet/walletData.service.js";
import {
    encodeChartCursor,
} from "@sv/util/chartCursor.js";
import { parseChartChunkInput } from "@sv/util/chartChunkParams.js";

const MAX_CHART_WALLETS = 5;
const DEFAULT_CHART_CHUNK_LIMIT = 180;
const MAX_CHART_CHUNK_LIMIT = 500;

function isChartChunkingEnabled(): boolean {
    const raw = String(process.env.CHART_CHUNKING_ENABLED ?? "true")
        .trim()
        .toLowerCase();
    return raw !== "false" && raw !== "0" && raw !== "no";
}

function logPnLRouteMemory(stage: string, extra?: Record<string, unknown>) {
    const usage = process.memoryUsage();
    console.log("[charts/pnl][memory]", {
        stage,
        rssMb: Number((usage.rss / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((usage.heapTotal / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((usage.heapUsed / 1024 / 1024).toFixed(2)),
        externalMb: Number((usage.external / 1024 / 1024).toFixed(2)),
        ...(extra ?? {}),
    });
}

const pnlRequestSchema = z.object({
    period: z
        .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
        .optional()
        .default("30D"),
    wallets: z.string().optional(),
    aggregation: z
        .enum(["daily", "weekly", "monthly"])
        .optional()
        .default("daily"),
    limit: z.coerce.number().int().min(1).max(MAX_CHART_CHUNK_LIMIT).optional().default(DEFAULT_CHART_CHUNK_LIMIT),
    cursor: z.string().optional(),
});

const app = new Hono().get("/", async (c) => {
    try {
        const query = c.req.query();
        const params = pnlRequestSchema.parse(query);

        const wallets = params.wallets
            ? params.wallets
                .split(",")
                .map((wallet) => wallet.trim())
                .filter((wallet) => wallet.length > 0)
            : [];

        if (wallets.length > MAX_CHART_WALLETS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `wallets exceeds max allowed (${MAX_CHART_WALLETS})`,
                },
                400,
            );
        }

        const hasChunkInput = query.limit != null || query.cursor != null;
        if (params.period === "All" && wallets.length > 1 && !hasChunkInput) {
            return c.json(
                {
                    error: "Validation error",
                    message: "Multi-wallet All requests require chunk params (limit and cursor pagination).",
                },
                400,
            );
        }

        const chunkingEnabled = isChartChunkingEnabled();
        const parsedChunkInput = parseChartChunkInput({
            c,
            cursor: params.cursor,
            endpoint: "pnl",
            timePeriod: params.period as WalletTimePeriod,
        });
        if (!parsedChunkInput.ok) {
            return parsedChunkInput.response;
        }

        const requestedRange = parsedChunkInput.value.requestedRange;

        logPnLRouteMemory("start", {
            wallets: wallets.length,
            period: params.period,
            aggregation: params.aggregation,
            chunkingEnabled,
            limit: params.limit,
            chunkToSec: parsedChunkInput.value.chunkToSec,
            heliusCursor: parsedChunkInput.value.heliusCursor,
        });

        const data = await getHistoricalPnLData(
            wallets,
            params.period,
            params.aggregation,
            chunkingEnabled
                ? {
                    limit: params.limit,
                    requestedFromSec: requestedRange.fromSec,
                    requestedToSec: requestedRange.toSec,
                    chunkToSec: parsedChunkInput.value.chunkToSec,
                    heliusCursor: parsedChunkInput.value.heliusCursor,
                }
                : undefined,
        );

        if (!chunkingEnabled || !data.chunkInfo || !data.cursorState) {
            logPnLRouteMemory("success", {
                mode: chunkingEnabled ? "chunk-no-state" : "legacy",
            });
            return c.json(data, 200);
        }

        const nextCursor =
            data.cursorState.hasMore && data.cursorState.nextChunkToSec != null
                ? encodeChartCursor({
                    endpoint: "pnl",
                    requestedFromSec: data.chunkInfo.requestedFromSec,
                    requestedToSec: data.chunkInfo.requestedToSec,
                    heliusCursor: data.cursorState.heliusCursor,
                    currentChunkFromSec: data.chunkInfo.chunkFromSec,
                    currentChunkToSec: data.cursorState.nextChunkToSec,
                    aggregationHint: data.chunkInfo.effectiveAggregation,
                    lastProcessedSignature: data.cursorState.lastProcessedSignature,
                })
                : null;

        logPnLRouteMemory("success", {
            mode: "chunk",
            hasMore: data.cursorState.hasMore,
        });

        return c.json(
            {
                ...data,
                pageInfo: {
                    pageSize: params.limit,
                    hasMore: data.cursorState.hasMore,
                    nextCursor,
                    source: "mixed" as const,
                },
            },
            200,
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json(
                {
                    error: "Validation error",
                    details: error.issues,
                },
                400,
            );
        }

        console.error("Error fetching P&L data:", error);
        return c.json(
            {
                error: "Failed to fetch P&L data",
                message: error instanceof Error ? error.message : "Unknown error",
            },
            500,
        );
    }
});

export default app;
