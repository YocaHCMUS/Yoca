/**
 * Balance Chart API Route
 *
 * Endpoint for fetching balance trend data with time-based aggregation.
 * Supports cursor-based chunk pagination for OOM-safe historical backfill.
 *
 * @module routes/charts/balance.route
 */

import { Hono } from "hono";
import { z } from "zod";
import { generateBalanceTrend } from "@sv/services/mockChartData.service.js";
import {
    getWalletBalanceHistory,
    getWalletBalanceHistoryChunk,
    getWalletTokenBalanceHistory,
    getWalletTokenBalanceHistoryChunk,
    resolveWalletTimeRangeSec,
    type WalletTimePeriod,
} from "@sv/services/wallet/walletData.service.js";
import { mapWithConcurrency } from "@sv/util/concurrency.js";
import {
    ChartCursorDecodeError,
    decodeChartCursor,
    encodeChartCursor,
} from "@sv/util/chartCursor.js";

const MAX_CHART_WALLETS = 5;
const MAX_CHART_TOKENS = 10;
const DEFAULT_CHART_CHUNK_LIMIT = 180;
const MAX_CHART_CHUNK_LIMIT = 500;
const MAX_WALLET_CHART_CONCURRENCY = 2;

function isChartChunkingEnabled(): boolean {
    const raw = String(process.env.CHART_CHUNKING_ENABLED ?? "true")
        .trim()
        .toLowerCase();
    return raw !== "false" && raw !== "0" && raw !== "no";
}

function logBalanceRouteMemory(stage: string, extra?: Record<string, unknown>) {
    const usage = process.memoryUsage();
    console.log("[charts/balance][memory]", {
        stage,
        rssMb: Number((usage.rss / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((usage.heapTotal / 1024 / 1024).toFixed(2)),
        heapUsedMb: Number((usage.heapUsed / 1024 / 1024).toFixed(2)),
        externalMb: Number((usage.external / 1024 / 1024).toFixed(2)),
        ...(extra ?? {}),
    });
}

const balanceRequestSchema = z.object({
    timePeriod: z
        .enum(["7D", "30D", "60D", "90D", "1Y", "All"])
        .optional()
        .default("30D"),
    tokens: z.string().optional(),
    wallets: z.string().optional(),
    timezone: z.string().optional().default("UTC"),
    limit: z.coerce.number().int().min(1).max(MAX_CHART_CHUNK_LIMIT).optional().default(DEFAULT_CHART_CHUNK_LIMIT),
    cursor: z.string().optional(),
});

const app = new Hono().get("/", async (c) => {
    try {
        const query = c.req.query();
        const params = balanceRequestSchema.parse(query);

        if (!params.wallets) {
            const data = generateBalanceTrend(params.timePeriod, params.tokens, params.wallets);
            return c.json(data, 200);
        }

        const walletAddresses = params.wallets
            .split(",")
            .map((wallet) => wallet.trim())
            .filter((wallet) => wallet.length > 0);
        const tokenSelectors = params.tokens
            ? params.tokens
                .split(",")
                .map((token) => token.trim())
                .filter((token) => token.length > 0)
            : [];

        if (walletAddresses.length === 0) {
            const data = generateBalanceTrend(params.timePeriod, params.tokens, params.wallets);
            return c.json(data, 200);
        }

        if (walletAddresses.length > MAX_CHART_WALLETS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `wallets exceeds max allowed (${MAX_CHART_WALLETS})`,
                },
                400,
            );
        }

        if (tokenSelectors.length > MAX_CHART_TOKENS) {
            return c.json(
                {
                    error: "Validation error",
                    message: `tokens exceeds max allowed (${MAX_CHART_TOKENS})`,
                },
                400,
            );
        }

        const hasChunkInput = query.limit != null || query.cursor != null;
        if (
            params.timePeriod === "All" &&
            walletAddresses.length > 1 &&
            !hasChunkInput
        ) {
            return c.json(
                {
                    error: "Validation error",
                    message: "Multi-wallet All requests require chunk params (limit and cursor pagination).",
                },
                400,
            );
        }

        const chunkingEnabled = isChartChunkingEnabled();
        let cursorPayload: ReturnType<typeof decodeChartCursor> | undefined;

        if (params.cursor) {
            try {
                cursorPayload = decodeChartCursor(params.cursor, "balance");
            } catch (err) {
                if (err instanceof ChartCursorDecodeError) {
                    return c.json(
                        {
                            error: "Validation error",
                            message: err.message,
                        },
                        400,
                    );
                }

                throw err;
            }
        }

        const requestedRange = cursorPayload
            ? {
                fromSec: cursorPayload.requestedFromSec,
                toSec: cursorPayload.requestedToSec,
            }
            : resolveWalletTimeRangeSec(params.timePeriod as WalletTimePeriod);

        const chunkToSec = cursorPayload?.currentChunkToSec;
        const chunkLimit = params.limit;

        logBalanceRouteMemory("start", {
            wallets: walletAddresses.length,
            tokens: tokenSelectors.length,
            timePeriod: params.timePeriod,
            chunkingEnabled,
            chunkToSec,
            limit: chunkLimit,
        });

        if (tokenSelectors.length === 0) {
            if (chunkingEnabled) {
                const allHistories = await mapWithConcurrency(
                    walletAddresses,
                    MAX_WALLET_CHART_CONCURRENCY,
                    async (address) =>
                        getWalletBalanceHistoryChunk(address, {
                            timePeriod: params.timePeriod as WalletTimePeriod,
                            requestedFromSec: requestedRange.fromSec,
                            requestedToSec: requestedRange.toSec,
                            chunkToSec,
                            limit: chunkLimit,
                            heliusCursor: cursorPayload?.heliusCursor ?? null,
                        }),
                );

                const series = walletAddresses.length === 1
                    ? [{
                        name: "Total",
                        data: allHistories[0].series.map((point) => ({
                            timestamp: point.timestamp,
                            value: point.value,
                        })),
                        seriesType: "line" as const,
                        unit: "USD" as const,
                    }]
                    : walletAddresses.map((address, index) => ({
                        name: `${address.substring(0, 8)}...`,
                        data: allHistories[index].series.map((point) => ({
                            timestamp: point.timestamp,
                            value: point.value,
                        })),
                        seriesType: "line" as const,
                        unit: "USD" as const,
                    }));

                const chunkInfo = allHistories[0]?.chunkInfo;
                const chunkState = allHistories[0]?.chunkState;
                const nextCursor =
                    chunkInfo && chunkState?.hasMore && chunkState.nextChunkToSec != null
                        ? encodeChartCursor({
                            endpoint: "balance",
                            requestedFromSec: chunkInfo.requestedFromSec,
                            requestedToSec: chunkInfo.requestedToSec,
                            heliusCursor: chunkState.heliusCursor,
                            currentChunkFromSec: chunkInfo.chunkFromSec,
                            currentChunkToSec: chunkState.nextChunkToSec,
                            aggregationHint: chunkInfo.effectiveAggregation,
                            lastProcessedSignature: chunkState.lastProcessedSignature,
                        })
                        : null;

                logBalanceRouteMemory("success", {
                    mode: "total",
                    seriesCount: series.length,
                    hasMore: chunkState?.hasMore ?? false,
                });

                return c.json(
                    {
                        series,
                        wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                        metadata: {
                            timePeriod: params.timePeriod,
                            aggregation: chunkInfo?.effectiveAggregation ?? "daily",
                            dataPoints: allHistories[0]?.series.length ?? 0,
                            currency: "USD",
                            timezone: params.timezone || "UTC",
                            mode: "total" as const,
                            tokens: [],
                            primaryYAxis: "USD" as const,
                        },
                        pageInfo: {
                            pageSize: chunkLimit,
                            hasMore: chunkState?.hasMore ?? false,
                            nextCursor,
                            source: "mixed" as const,
                        },
                        chunkInfo,
                    },
                    200,
                );
            }

            const allHistories = await mapWithConcurrency(
                walletAddresses,
                MAX_WALLET_CHART_CONCURRENCY,
                async (address) => getWalletBalanceHistory(address, params.timePeriod),
            );

            const series = walletAddresses.length === 1
                ? [{
                    name: "Total",
                    data: allHistories[0].map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "line" as const,
                    unit: "USD" as const,
                }]
                : walletAddresses.map((address, index) => ({
                    name: `${address.substring(0, 8)}...`,
                    data: allHistories[index].map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "line" as const,
                    unit: "USD" as const,
                }));

            logBalanceRouteMemory("success", {
                mode: "total-legacy",
                seriesCount: series.length,
            });

            return c.json(
                {
                    series,
                    wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                    metadata: {
                        timePeriod: params.timePeriod,
                        aggregation: "daily",
                        dataPoints: allHistories[0]?.length ?? 0,
                        currency: "USD",
                        timezone: params.timezone || "UTC",
                        mode: "total" as const,
                        tokens: [],
                        primaryYAxis: "USD" as const,
                    },
                    pageInfo: {
                        pageSize: allHistories[0]?.length ?? 0,
                        hasMore: false,
                        nextCursor: null,
                        source: "mixed" as const,
                    },
                },
                200,
            );
        }

        if (chunkingEnabled) {
            const pairs = walletAddresses.flatMap((address) =>
                tokenSelectors.map((token) => ({ address, token })),
            );

            const pairResults = await mapWithConcurrency(
                pairs,
                MAX_WALLET_CHART_CONCURRENCY,
                async ({ address, token }) =>
                    getWalletTokenBalanceHistoryChunk(address, token, {
                        timePeriod: params.timePeriod as WalletTimePeriod,
                        requestedFromSec: requestedRange.fromSec,
                        requestedToSec: requestedRange.toSec,
                        chunkToSec,
                        limit: chunkLimit,
                    }),
            );

            const series = pairs.flatMap(({ address }, index) => {
                const result = pairResults[index];
                const prefix = walletAddresses.length > 1 ? `${address.substring(0, 8)}... ` : "";
                return [
                    {
                        name: `${prefix}${result.tokenSymbol} (units)`,
                        data: result.tokenSeries.map((point) => ({
                            timestamp: point.timestamp,
                            value: point.value,
                        })),
                        seriesType: "line" as const,
                        unit: "TOKEN" as const,
                    },
                    {
                        name: `${prefix}${result.tokenSymbol} (USD)`,
                        data: result.usdSeries.map((point) => ({
                            timestamp: point.timestamp,
                            value: point.value,
                        })),
                        seriesType: "bar" as const,
                        unit: "USD" as const,
                    },
                ];
            });

            const chunkInfo = pairResults[0]?.chunkInfo;
            const chunkState = pairResults[0]?.chunkState;
            const nextCursor =
                chunkInfo && chunkState?.hasMore && chunkState.nextChunkToSec != null
                    ? encodeChartCursor({
                        endpoint: "balance",
                        requestedFromSec: chunkInfo.requestedFromSec,
                        requestedToSec: chunkInfo.requestedToSec,
                        heliusCursor: chunkState.heliusCursor,
                        currentChunkFromSec: chunkInfo.chunkFromSec,
                        currentChunkToSec: chunkState.nextChunkToSec,
                        aggregationHint: chunkInfo.effectiveAggregation,
                        lastProcessedSignature: chunkState.lastProcessedSignature,
                    })
                    : null;

            logBalanceRouteMemory("success", {
                mode: "token",
                pairCount: pairs.length,
                seriesCount: series.length,
                hasMore: chunkState?.hasMore ?? false,
            });

            return c.json(
                {
                    series,
                    wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                    metadata: {
                        timePeriod: params.timePeriod,
                        aggregation: chunkInfo?.effectiveAggregation ?? "daily",
                        dataPoints: pairResults[0]?.tokenSeries.length ?? 0,
                        currency: "USD",
                        timezone: params.timezone || "UTC",
                        mode: "token" as const,
                        tokens: tokenSelectors,
                        primaryYAxis: "TOKEN" as const,
                    },
                    pageInfo: {
                        pageSize: chunkLimit,
                        hasMore: chunkState?.hasMore ?? false,
                        nextCursor,
                        source: "mixed" as const,
                    },
                    chunkInfo,
                },
                200,
            );
        }

        const pairs = walletAddresses.flatMap((address) =>
            tokenSelectors.map((token) => ({ address, token })),
        );

        const pairResults = await mapWithConcurrency(
            pairs,
            MAX_WALLET_CHART_CONCURRENCY,
            async ({ address, token }) =>
                getWalletTokenBalanceHistory(address, token, params.timePeriod),
        );

        const series = pairs.flatMap(({ address }, index) => {
            const result = pairResults[index];
            const prefix = walletAddresses.length > 1 ? `${address.substring(0, 8)}... ` : "";
            return [
                {
                    name: `${prefix}${result.tokenSymbol} (units)`,
                    data: result.tokenSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "line" as const,
                    unit: "TOKEN" as const,
                },
                {
                    name: `${prefix}${result.tokenSymbol} (USD)`,
                    data: result.usdSeries.map((point) => ({ timestamp: point.timestamp, value: point.value })),
                    seriesType: "bar" as const,
                    unit: "USD" as const,
                },
            ];
        });

        logBalanceRouteMemory("success", {
            mode: "token-legacy",
            pairCount: pairs.length,
            seriesCount: series.length,
        });

        return c.json(
            {
                series,
                wallets: walletAddresses.length > 1 ? walletAddresses : undefined,
                metadata: {
                    timePeriod: params.timePeriod,
                    aggregation: "daily",
                    dataPoints: pairResults[0]?.tokenSeries.length ?? 0,
                    currency: "USD",
                    timezone: params.timezone || "UTC",
                    mode: "token" as const,
                    tokens: tokenSelectors,
                    primaryYAxis: "TOKEN" as const,
                },
                pageInfo: {
                    pageSize: pairResults[0]?.tokenSeries.length ?? 0,
                    hasMore: false,
                    nextCursor: null,
                    source: "mixed" as const,
                },
            },
            200,
        );
    } catch (error) {
        if (error instanceof z.ZodError) {
            return c.json({ error: "Validation error", details: error.issues }, 400);
        }

        console.error("[BalanceChart] Error fetching wallet balance history:", error);
        const query = c.req.query();
        const timePeriod = (query.timePeriod as WalletTimePeriod) ?? "30D";
        const data = generateBalanceTrend(timePeriod, query.tokens, query.wallets);
        return c.json(data, 200);
    }
});

export default app;
