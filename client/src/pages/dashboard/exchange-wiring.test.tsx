// @vitest-environment jsdom

import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeComparisonSpy = vi.fn();

vi.mock("@carbon/react", () => ({
    Grid: ({ children }: { children: any }) => <div>{children}</div>,
    Column: ({ children }: { children: any }) => <div>{children}</div>,
    Tile: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key: string) => key,
    }),
}));

vi.mock("../../components/wrapper", () => ({
    PageWrapper: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("../../contexts/ChartContext", () => ({
    ChartProvider: ({ children }: { children: any }) => <div>{children}</div>,
}));

vi.mock("../../components/charts/BalanceChart", () => ({
    BalanceChart: () => <div data-testid="balance-chart" />,
}));

vi.mock("../../components/charts/AssetDistribution", () => ({
    AssetDistribution: () => <div data-testid="asset-distribution" />,
}));

vi.mock("../../components/charts/PnLChart", () => ({
    PnLChart: () => <div data-testid="pnl-chart" />,
}));

vi.mock("../../components/charts/ExchangeComparison", () => ({
    ExchangeComparison: (props: unknown) => {
        exchangeComparisonSpy(props);
        return <div data-testid="exchange-comparison" />;
    },
}));

vi.mock("../../components/charts/CounterpartyActivity", () => ({
    CounterpartyActivity: () => <div data-testid="counterparty-activity" />,
}));

vi.mock("../../components/charts/VolumeBenchmark", () => ({
    VolumeBenchmark: () => <div data-testid="volume-benchmark" />,
}));

vi.mock("../../components/charts/TransactionDistribution", () => ({
    TransactionDistribution: () => <div data-testid="transaction-distribution" />,
}));

vi.mock("../../components/charts/HoldingDurations", () => ({
    HoldingDurations: () => <div data-testid="holding-durations" />,
}));

import DashboardPage from "./index";

describe("DashboardPage exchange chart wiring", () => {
    beforeEach(() => {
        exchangeComparisonSpy.mockReset();
    });

    it("does not pass wallet-scoped props to ExchangeComparison", async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(exchangeComparisonSpy).toHaveBeenCalled();
        });

        const firstCallProps = exchangeComparisonSpy.mock.calls[0][0] as {
            walletAddress?: string;
            chain?: string;
        };

        expect(firstCallProps.walletAddress).toBeUndefined();
        expect(firstCallProps.chain).toBeUndefined();
    });
});