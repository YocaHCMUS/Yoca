import { describe, expect, it, vi } from "vitest";
import { createWalletMockRouter, resolveWalletMockFlag } from "@/api/walletMockRouter";

function makeJsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

function createClientStub() {
    const liveOverview = vi.fn(async () => makeJsonResponse({ source: "live" }));

    const client = {
        api: {
            wallets: {
                overview: { $get: liveOverview },
                portfolio: { $get: vi.fn(async () => makeJsonResponse([])) },
                swap: { $get: vi.fn(async () => makeJsonResponse({ swaps: [], pageInfo: {} })) },
                transfers: { $get: vi.fn(async () => makeJsonResponse({ transfers: [], pageInfo: {} })) },
                counterparties: { $get: vi.fn(async () => makeJsonResponse({ counterparties: [], rankings: {}, metadata: {} })) },
                exchanges: { $get: vi.fn(async () => makeJsonResponse({ exchanges: [] })) },
                identity: {
                    $get: vi.fn(async () => makeJsonResponse({ identity: null })),
                    batch: { $post: vi.fn(async () => makeJsonResponse({ data: [] })) },
                },
                intelligence: { $get: vi.fn(async () => makeJsonResponse({})) },
            },
            charts: {
                balance: { $get: vi.fn(async () => makeJsonResponse({ series: [] })) },
                pnl: { $get: vi.fn(async () => makeJsonResponse({ dailyPnL: [], cumulativePnL: [], metadata: {} })) },
                distribution: { $get: vi.fn(async () => makeJsonResponse({ data: [], metadata: {} })) },
                exchanges: { $get: vi.fn(async () => makeJsonResponse({ exchanges: [], metadata: {} })) },
                counterparties: { $get: vi.fn(async () => makeJsonResponse({ counterparties: [], metadata: {} })) },
            },
        },
    };

    return { client, liveOverview };
}

describe("resolveWalletMockFlag", () => {
    it("parses common true/false env values", () => {
        expect(resolveWalletMockFlag(undefined)).toBe(false);
        expect(resolveWalletMockFlag("false")).toBe(false);
        expect(resolveWalletMockFlag("0")).toBe(false);
        expect(resolveWalletMockFlag("true")).toBe(true);
        expect(resolveWalletMockFlag("1")).toBe(true);
        expect(resolveWalletMockFlag("yes")).toBe(true);
        expect(resolveWalletMockFlag("on")).toBe(true);
    });
});

describe("createWalletMockRouter", () => {
    it("returns original client when disabled", () => {
        const { client } = createClientStub();
        const routed = createWalletMockRouter(client as any, false);
        expect(routed).toBe(client);
    });

    it("intercepts wallet overview and chart balance calls when enabled", async () => {
        const { client, liveOverview } = createClientStub();
        const routed = createWalletMockRouter(client as any, true);

        const overviewResponse = await routed.api.wallets.overview.$get({
            query: { address: "wallet-empty" },
        } as any);
        const overview = await overviewResponse.json();

        expect(liveOverview).not.toHaveBeenCalled();
        expect(overview.address).toBe("wallet-empty");
        expect(Array.isArray(overview.availablePeriods)).toBe(true);

        const balanceResponse = await routed.api.charts.balance.$get({
            query: { wallets: "wallet-a,wallet-b", tokens: "SOL,USDC", timePeriod: "30D", timezone: "UTC" },
        } as any);
        const balance = await balanceResponse.json();

        expect(Array.isArray(balance.series)).toBe(true);
        expect(Array.isArray(balance.wallets)).toBe(true);
        expect(balance.metadata.currency).toBe("USD");
        expect(balance.metadata.timezone).toBe("UTC");
        expect(balance.metadata.tokenMeta).toBeTruthy();
        expect(balance.metadata.walletMeta).toBeTruthy();
    });
});
