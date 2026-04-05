import type { AppType } from "@sv/main.js";
import { hc } from "hono/client";
import {
    generateMockAssetDistribution,
    generateMockBalanceChart,
    generateMockCounterpartyActivity,
    generateMockExchangeComparison,
    generateMockPnLChart,
    generateMockWalletCounterparties,
    generateMockWalletExchanges,
    generateMockWalletIdentity,
    generateMockWalletIntelligence,
    generateMockWalletOverview,
    generateMockWalletPortfolio,
    generateMockWalletSwaps,
    generateMockWalletTransfers,
} from "@/services/wallet/mockWalletData";

type ApiClient = ReturnType<typeof hc<AppType>>;

type QueryContainer = {
    query?: Record<string, unknown>;
};

function jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function readQuery(input?: QueryContainer): Record<string, unknown> {
    if (!input || typeof input.query !== "object" || !input.query) {
        return {};
    }
    return input.query;
}

function asString(value: unknown): string | undefined {
    return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim()) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}

export function resolveWalletMockFlag(raw: string | undefined | null): boolean {
    if (!raw) {
        return false;
    }

    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function isWalletMockModeEnabled(env: ImportMetaEnv): boolean {
    return resolveWalletMockFlag(env.VITE_USE_WALLET_MOCKS);
}

export function createWalletMockRouter(client: ApiClient, enabled: boolean): ApiClient {
    if (!enabled) {
        return client;
    }

    return {
        ...client,
        api: {
            ...client.api,
            wallets: {
                ...client.api.wallets,
                overview: {
                    ...client.api.wallets.overview,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockWalletOverview(asString(query.address) ?? "wallet-single-mock"));
                    },
                },
                portfolio: {
                    ...client.api.wallets.portfolio,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockWalletPortfolio(asString(query.address) ?? "wallet-single-mock"));
                    },
                },
                swap: {
                    ...client.api.wallets.swap,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        const address = asString(query.address) ?? "wallet-single-mock";
                        const cursor = asString(query.cursor) ?? asString(query.before);
                        return jsonResponse(generateMockWalletSwaps(address, cursor));
                    },
                },
                transfers: {
                    ...client.api.wallets.transfers,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        const address = asString(query.address) ?? "wallet-single-mock";
                        const cursor = asString(query.cursor);
                        return jsonResponse(generateMockWalletTransfers(address, cursor));
                    },
                },
                counterparties: {
                    ...client.api.wallets.counterparties,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        const address = asString(query.address) ?? "wallet-single-mock";
                        const period = asString(query.period) === "24h" ? "24h" : "7d";
                        const limit = asNumber(query.limit);
                        return jsonResponse(generateMockWalletCounterparties(address, period, limit));
                    },
                },
                exchanges: {
                    ...client.api.wallets.exchanges,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        const metric = asString(query.metric) === "volume" ? "volume" : "count";
                        return jsonResponse(generateMockWalletExchanges(asString(query.address) ?? "wallet-single-mock", metric, asNumber(query.limit)));
                    },
                },
                identity: {
                    ...client.api.wallets.identity,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockWalletIdentity(asString(query.address) ?? "wallet-single-mock"));
                    },
                    batch: {
                        ...client.api.wallets.identity.batch,
                        $post: async () => {
                            return jsonResponse({
                                data: [],
                                source: "mock",
                            });
                        },
                    },
                },
                intelligence: {
                    ...client.api.wallets.intelligence,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockWalletIntelligence(asString(query.address) ?? "wallet-single-mock"));
                    },
                },
            },
            charts: {
                ...client.api.charts,
                balance: {
                    ...client.api.charts.balance,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockBalanceChart({
                            wallets: asString(query.wallets),
                            tokens: asString(query.tokens),
                            timePeriod: asString(query.timePeriod),
                            timezone: asString(query.timezone),
                        }));
                    },
                },
                pnl: {
                    ...client.api.charts.pnl,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        const aggregation = asString(query.aggregation);
                        return jsonResponse(generateMockPnLChart({
                            wallets: asString(query.wallets),
                            period: asString(query.period),
                            aggregation: aggregation === "weekly" || aggregation === "monthly" ? aggregation : "daily",
                        }));
                    },
                },
                distribution: {
                    ...client.api.charts.distribution,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockAssetDistribution({ wallets: asString(query.wallets) }));
                    },
                },
                exchanges: {
                    ...client.api.charts.exchanges,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockExchangeComparison({
                            metric: asString(query.metric) === "volume" ? "volume" : "count",
                            wallet: asString(query.wallet),
                        }));
                    },
                },
                counterparties: {
                    ...client.api.charts.counterparties,
                    $get: async (args?: QueryContainer) => {
                        const query = readQuery(args);
                        return jsonResponse(generateMockCounterpartyActivity({
                            wallets: asString(query.wallets),
                            address: asString(query.address),
                            limit: asNumber(query.limit),
                            timePeriod: asString(query.timePeriod),
                            transactionType: asString(query.transactionType),
                        }));
                    },
                },
            },
        },
    } as ApiClient;
}
