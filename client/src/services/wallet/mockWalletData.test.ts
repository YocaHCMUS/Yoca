import { describe, expect, it } from "vitest";
import type {
    WalletCounterpartiesResponse,
    WalletOverviewMultiPeriodResponse,
    WalletPortfolioItem,
    WalletSwapsResponse,
    WalletTransfersResponse,
} from "@/services/wallet/walletApi";
import type { BalanceTrendResponse, PnLChartResponse } from "@/types/chart-api.types";
import {
    generateMockBalanceChart,
    generateMockPnLChart,
    generateMockWalletCounterparties,
    generateMockWalletOverview,
    generateMockWalletPortfolio,
    generateMockWalletSwaps,
    generateMockWalletTransfers,
    getWalletMockScenario,
} from "@/services/wallet/mockWalletData";

describe("mock wallet data contracts", () => {
    it("matches wallet response interfaces and remains deterministic per address", () => {
        const address = "wallet-high-activity";

        const overviewA: WalletOverviewMultiPeriodResponse = generateMockWalletOverview(address);
        const overviewB: WalletOverviewMultiPeriodResponse = generateMockWalletOverview(address);
        const portfolioA: WalletPortfolioItem[] = generateMockWalletPortfolio(address);
        const portfolioB: WalletPortfolioItem[] = generateMockWalletPortfolio(address);
        const swapsA: WalletSwapsResponse = generateMockWalletSwaps(address);
        const swapsB: WalletSwapsResponse = generateMockWalletSwaps(address);
        const transfersA: WalletTransfersResponse = generateMockWalletTransfers(address);
        const transfersB: WalletTransfersResponse = generateMockWalletTransfers(address);
        const counterparties: WalletCounterpartiesResponse = generateMockWalletCounterparties(address, "7d", 10);

        expect(overviewA).toEqual(overviewB);
        expect(portfolioA).toEqual(portfolioB);
        expect(swapsA).toEqual(swapsB);
        expect(transfersA).toEqual(transfersB);

        expect(overviewA.address).toBe(address);
        expect(Array.isArray(overviewA.availablePeriods)).toBe(true);
        expect(Array.isArray(portfolioA)).toBe(true);
        expect(Array.isArray(swapsA.swaps)).toBe(true);
        expect(Array.isArray(transfersA.transfers)).toBe(true);
        expect(Array.isArray(counterparties.rankings.byTransactionCount)).toBe(true);
    });

    it("supports deterministic scenario presets", () => {
        expect(getWalletMockScenario("wallet-empty")).toBe("empty");
        expect(getWalletMockScenario("wallet-single")).toBe("single-token");
        expect(getWalletMockScenario("wallet-multi")).toBe("multi-wallet");
        expect(getWalletMockScenario("wallet-active")).toBe("high-activity");
    });

    it("provides stable pagination cursors and page metadata", () => {
        const first = generateMockWalletSwaps("wallet-high-activity");
        const second = generateMockWalletSwaps("wallet-high-activity", first.pageInfo.nextCursor ?? undefined);

        expect(first.pageInfo.pageSize).toBe(100);
        expect(first.pageInfo.source).toBe("mixed");
        expect(first.pageInfo.hasMore).toBe(true);
        expect(second.swaps[0]?.signature).not.toEqual(first.swaps[0]?.signature);
    });
});

describe("mock wallet chart contracts", () => {
    it("returns balance metadata required by wallet charts", () => {
        const response: BalanceTrendResponse = generateMockBalanceChart({
            wallets: "wallet-a,wallet-b",
            tokens: "SOL,USDC",
            timePeriod: "30D",
            timezone: "UTC",
        });

        expect(Array.isArray(response.wallets)).toBe(true);
        expect(response.metadata.currency).toBe("USD");
        expect(response.metadata.timezone).toBe("UTC");
        expect(response.metadata.tokenMeta).toBeTruthy();
        expect(response.metadata.walletMeta).toBeTruthy();
    });

    it("returns aggregate or multi-wallet pnl shapes", () => {
        const aggregate: PnLChartResponse = generateMockPnLChart({ period: "30D" });
        const multi: PnLChartResponse = generateMockPnLChart({ wallets: "wallet-a,wallet-b", period: "30D" });

        expect(Array.isArray(aggregate.dailyPnL)).toBe(true);
        expect(Array.isArray(aggregate.cumulativePnL)).toBe(true);
        expect(Array.isArray(multi.wallets)).toBe(true);
        expect(multi.wallets?.length).toBe(2);
    });
});
