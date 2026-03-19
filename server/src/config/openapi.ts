import type { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "@hono/zod-openapi";
import { AUTH_COOKIE_NAME } from "./constants.js";

const periodEnum = z.enum(["7D", "30D", "60D", "90D", "1Y", "All"]);
const chartTxnTypeEnum = z.enum(["all", "deposits", "withdrawals", "trades"]);
const transferTypeEnum = z.enum(["all", "deposits", "withdrawals"]);

const successSchema = z.union([z.object({}).passthrough(), z.array(z.unknown())]);
const errorSchema = z
    .object({
        error: z.string(),
        message: z.string().optional(),
        code: z.string().optional(),
    })
    .passthrough();

const successResponse = {
    description: "Successful response",
    content: {
        "application/json": {
            schema: successSchema,
        },
    },
};

const badRequestResponse = {
    description: "Bad request",
    content: {
        "application/json": {
            schema: errorSchema,
        },
    },
};

const unauthorizedResponse = {
    description: "Unauthorized",
    content: {
        "application/json": {
            schema: errorSchema,
        },
    },
};

const internalErrorResponse = {
    description: "Internal server error",
    content: {
        "application/json": {
            schema: errorSchema,
        },
    },
};

export function registerOpenApiRoutes(app: OpenAPIHono): void {
    app.openAPIRegistry.registerComponent("securitySchemes", "CookieAuth", {
        type: "apiKey",
        in: "cookie",
        name: AUTH_COOKIE_NAME,
        description: "JWT cookie authentication",
    });

    const walletGetRouteDocs = [
        {
            path: "/api/wallets/overview",
            summary: "Get wallet overview",
            query: z.object({
                address: z.string(),
                period: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/portfolio",
            summary: "Get wallet portfolio",
            query: z.object({
                address: z.string(),
            }),
        },
        {
            path: "/api/wallets/transactions",
            summary: "Get wallet transactions",
            query: z.object({
                address: z.string(),
                limit: z.string().optional(),
                cursor: z.string().optional(),
                before: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/swap",
            summary: "Get wallet swaps",
            query: z.object({
                address: z.string(),
                limit: z.string().optional(),
                cursor: z.string().optional(),
                before: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/transfers",
            summary: "Get wallet transfers",
            query: z.object({
                address: z.string(),
                limit: z.string().optional(),
                cursor: z.string().optional(),
                before: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/distribution",
            summary: "Get wallet asset distribution",
            query: z.object({
                address: z.string(),
            }),
        },
        {
            path: "/api/wallets/exchanges",
            summary: "Get wallet exchange counts",
            query: z.object({
                address: z.string(),
                limit: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/counterparties",
            summary: "Get wallet counterparties",
            query: z.object({
                address: z.string(),
                period: z.string().optional(),
                limit: z.string().optional(),
                includeTokens: z.string().optional(),
            }),
        },
        {
            path: "/api/wallets/identity",
            summary: "Get wallet identity",
            query: z.object({
                address: z.string(),
            }),
        },
        {
            path: "/api/wallets/intelligence",
            summary: "Get wallet intelligence",
            query: z.object({
                address: z.string(),
            }),
        },
        {
            path: "/api/wallets/debug/test-transactions",
            summary: "Get debug test transaction payload",
            query: z.object({
                address: z.string(),
            }),
        },
    ] as const;

    for (const route of walletGetRouteDocs) {
        app.openAPIRegistry.registerPath({
            method: "get",
            path: route.path,
            tags: ["Wallets"],
            summary: route.summary,
            request: {
                query: route.query,
            },
            responses: {
                200: successResponse,
                400: badRequestResponse,
                500: internalErrorResponse,
            },
        });
    }

    app.openAPIRegistry.registerPath({
        method: "post",
        path: "/api/wallets/identity/batch",
        tags: ["Wallets"],
        summary: "Get identities for multiple wallet addresses",
        request: {
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            addresses: z.array(z.string().trim().min(1)).min(1),
                        }),
                    },
                },
            },
        },
        responses: {
            200: successResponse,
            400: badRequestResponse,
            500: internalErrorResponse,
        },
    });

    app.openAPIRegistry.registerPath({
        method: "get",
        path: "/api/walletTags",
        tags: ["Wallet Tags"],
        summary: "Get saved tags for a wallet",
        security: [{ CookieAuth: [] }],
        request: {
            query: z.object({
                address: z.string().min(1),
            }),
        },
        responses: {
            200: {
                description: "Successful response",
                content: {
                    "application/json": {
                        schema: z.object({
                            tags: z.array(z.string()),
                        }),
                    },
                },
            },
            400: badRequestResponse,
            401: unauthorizedResponse,
            500: internalErrorResponse,
        },
    });

    app.openAPIRegistry.registerPath({
        method: "put",
        path: "/api/walletTags",
        tags: ["Wallet Tags"],
        summary: "Save tags for a wallet",
        security: [{ CookieAuth: [] }],
        request: {
            body: {
                required: true,
                content: {
                    "application/json": {
                        schema: z.object({
                            address: z.string().min(1),
                            tags: z.array(z.string().trim().min(1).max(30)).max(50),
                        }),
                    },
                },
            },
        },
        responses: {
            200: {
                description: "Successful response",
                content: {
                    "application/json": {
                        schema: z.object({
                            message: z.string(),
                        }),
                    },
                },
            },
            400: badRequestResponse,
            401: unauthorizedResponse,
            500: internalErrorResponse,
        },
    });

    const chartRouteDocs = [
        {
            path: "/api/charts/balance",
            summary: "Get balance chart data",
            query: z.object({
                timePeriod: periodEnum.optional(),
                tokens: z.string().optional(),
                wallets: z.string().optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/distribution",
            summary: "Get distribution chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/pnl",
            summary: "Get PnL chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
                aggregation: z.enum(["daily", "weekly", "monthly"]).optional(),
            }),
        },
        {
            path: "/api/charts/exchanges",
            summary: "Get exchange chart data",
            query: z.object({
                timePeriod: periodEnum.optional(),
                metric: z.enum(["count", "volume"]).optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/counterparties",
            summary: "Get counterparties chart data",
            query: z.object({
                timePeriod: periodEnum.optional(),
                transactionType: chartTxnTypeEnum.optional(),
                limit: z.string().optional(),
                timezone: z.string().optional(),
                wallets: z.string().optional(),
                address: z.string().optional(),
                period: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/volume",
            summary: "Get volume chart data",
            query: z.object({
                timePeriod: periodEnum.optional(),
                walletIds: z.string().optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/transactions",
            summary: "Get transactions chart data",
            query: z.object({
                timePeriod: periodEnum.optional(),
                transactionType: chartTxnTypeEnum.optional(),
                walletIds: z.string().optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/holdings",
            summary: "Get holdings chart data",
            query: z.object({
                walletIds: z.string().optional(),
                topN: z.string().optional(),
                timeUnit: z.enum(["days", "weeks", "months"]).optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/price-history",
            summary: "Get price history chart data",
            query: z.object({
                tokens: z.string().optional(),
                period: periodEnum.optional(),
                aggregation: z.enum(["hourly", "daily", "weekly", "monthly"]).optional(),
            }),
        },
        {
            path: "/api/charts/dailyTradingVolume",
            summary: "Get daily trading volume chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/tradingVolumeDistribution",
            summary: "Get trading volume distribution chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/tradingVolumePerTransaction",
            summary: "Get trading volume per transaction chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
                type: transferTypeEnum.optional(),
            }),
        },
        {
            path: "/api/charts/rollingAnnualReturn",
            summary: "Get rolling annual return chart data",
            query: z.object({
                wallets: z.string().optional(),
                period: z.string().optional(),
                timeUnit: z.enum(["month", "quarter", "year", "custom"]).optional(),
                windowSize: z.string().optional(),
                timezone: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/averageRollingAnnualReturn",
            summary: "Get average rolling annual return chart data",
            query: z.object({
                wallets: z.string().optional(),
                period: z.string().optional(),
                timeUnit: z.enum(["month", "quarter", "year", "custom"]).optional(),
                windowSize: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/winrate",
            summary: "Get winrate chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/drawdown",
            summary: "Get drawdown chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/totalTradingVolume",
            summary: "Get total trading volume chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
        {
            path: "/api/charts/stablecoinRatio",
            summary: "Get stablecoin ratio chart data",
            query: z.object({
                period: periodEnum.optional(),
                wallets: z.string().optional(),
            }),
        },
    ] as const;

    for (const route of chartRouteDocs) {
        app.openAPIRegistry.registerPath({
            method: "get",
            path: route.path,
            tags: ["Charts"],
            summary: route.summary,
            request: {
                query: route.query,
            },
            responses: {
                200: successResponse,
                400: badRequestResponse,
                500: internalErrorResponse,
            },
        });
    }
}
