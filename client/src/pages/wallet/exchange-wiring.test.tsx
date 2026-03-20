// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => ({
    exchangeComparisonSpy: vi.fn(),
    fetchWalletPortfolioMock: vi.fn(),
    fetchWalletSwapsMock: vi.fn(),
    fetchWalletTransfersMock: vi.fn(),
    fetchWalletCounterpartiesMock: vi.fn(),
}));

vi.mock("@/components/charts/AssetDistribution/AssetDistribution.tsx", () => ({
    AssetDistribution: () => <div data-testid="asset-distribution" />,
}));

vi.mock("@/components/charts/BalanceChart/BalanceChart.tsx", () => ({
    BalanceChart: () => <div data-testid="balance-chart" />,
}));

vi.mock("@/components/charts/CounterpartyActivity/CounterpartyActivity.tsx", () => ({
    CounterpartyActivity: () => <div data-testid="counterparty-activity" />,
}));

vi.mock("@/components/charts/ExchangeComparison/ExchangeComparison.tsx", () => ({
    ExchangeComparison: (props: unknown) => {
        hoisted.exchangeComparisonSpy(props);
        return <div data-testid="exchange-comparison" />;
    },
}));

vi.mock("@/components/charts/PnLChart/PnLChart.tsx", () => ({
    PnLChart: () => <div data-testid="pnl-chart" />,
}));

vi.mock("@/components/tabContainer/tabContainer.tsx", () => ({
    default: () => <div data-testid="tab-container" />,
}));

vi.mock("@/components/tables/Table.tsx", () => ({
    Table: () => <div data-testid="table" />,
    FilterType: {
        Select: "select",
        Range: "range",
        DateTime: "datetime",
    },
    SortType: {
        String: "string",
        Number: "number",
        Date: "date",
    },
}));

vi.mock("@/components/tables/TableCellRenderer.tsx", () => ({
    renderBase: vi.fn(() => null),
    renderCode: vi.fn(() => null),
    renderCurrency: vi.fn(() => null),
    renderDateTime: vi.fn(() => null),
    renderHash: vi.fn(() => null),
    renderPositiveNegative: vi.fn(() => null),
    renderReducedNumber: vi.fn(() => null),
}));

vi.mock("@/components/wallet/SwapDetailModal/SwapDetailModal.tsx", () => ({
    SwapDetailModal: () => <div data-testid="swap-detail-modal" />,
}));

vi.mock("@/components/wallet/WalletOverview/WalletOverview.tsx", () => ({
    default: () => <div data-testid="wallet-overview" />,
}));

vi.mock("@/components/wrapper/PageWrapper.tsx", () => ({
    PageWrapper: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("@/contexts/LocalizationContext.tsx", () => ({
    useLocalization: () => ({
        tr: (key: string) => key,
        fmt: {
            number: (value: unknown) => String(value ?? ""),
            currency: (value: unknown) => String(value ?? ""),
        },
        lang: "en",
    }),
}));

vi.mock("@/config/localization/index.ts", () => ({
    locale: {
        en: { langCode: "en-US" },
    },
}));

vi.mock("@/services/wallet/walletApi.ts", () => ({
    fetchWalletCounterparties: hoisted.fetchWalletCounterpartiesMock,
    fetchWalletPortfolio: hoisted.fetchWalletPortfolioMock,
    fetchWalletTransfers: hoisted.fetchWalletTransfersMock,
    fetchWalletSwaps: hoisted.fetchWalletSwapsMock,
}));

vi.mock("react-router", () => ({
    useParams: () => ({ address: "wallet-abc" }),
}));

vi.mock("../../util/wallet-portfolio-mapper.ts", () => ({
    mapPortfolioItems: () => ({ rows: [], meta: [] }),
    buildPortfolioMetaMap: () => new Map(),
}));

vi.mock("@/components/token/TokenIdentityCell.tsx", () => ({
    TokenIdentityCell: () => <div data-testid="token-identity-cell" />,
}));

import WalletPage from "./index.tsx";

describe("WalletPage exchange chart wiring", () => {
    beforeEach(() => {
        hoisted.exchangeComparisonSpy.mockReset();
        hoisted.fetchWalletPortfolioMock.mockReset();
        hoisted.fetchWalletSwapsMock.mockReset();
        hoisted.fetchWalletTransfersMock.mockReset();
        hoisted.fetchWalletCounterpartiesMock.mockReset();

        hoisted.fetchWalletPortfolioMock.mockResolvedValue([]);
        hoisted.fetchWalletSwapsMock.mockResolvedValue({
            swaps: [],
            pageInfo: {
                pageSize: 100,
                hasMore: false,
                nextCursor: null,
                source: "provider",
            },
        });
        hoisted.fetchWalletTransfersMock.mockResolvedValue({
            transfers: [],
            pageInfo: {
                pageSize: 100,
                hasMore: false,
                nextCursor: null,
                source: "provider",
            },
        });
        hoisted.fetchWalletCounterpartiesMock.mockResolvedValue({
            counterparties: [],
            rankings: {
                byTransactionCount: [],
                byVolume: [],
            },
            metadata: {
                period: "7d",
                source: "provider",
                totals: {
                    counterparties: 0,
                    transactions: 0,
                    volume: 0,
                },
            },
        });
    });

    it("passes wallet address context into ExchangeComparison", async () => {
        render(<WalletPage />);

        await waitFor(() => {
            expect(hoisted.exchangeComparisonSpy).toHaveBeenCalled();
        });

        const hasWalletScopedCall = hoisted.exchangeComparisonSpy.mock.calls.some(([props]) => {
            const typed = props as { walletAddress?: string; chain?: string };
            return typed.walletAddress === "wallet-abc" && typed.chain === "solana";
        });

        expect(hasWalletScopedCall).toBe(true);
    });
});