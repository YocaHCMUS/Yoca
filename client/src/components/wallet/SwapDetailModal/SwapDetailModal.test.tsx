// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WalletSwap } from "@/services/wallet/walletApi";
import { ID_MODAL_ROOT } from "@/config/constants";
import { SwapDetailModal } from "./SwapDetailModal";

function buildSwap(overrides: Partial<WalletSwap> = {}): WalletSwap {
    const sold = {
        mint: "So11111111111111111111111111111111111111112",
        amount: -1.25,
        decimals: 9,
        symbol: "SOL",
        name: "Solana",
        logoUri: "https://cdn.example.com/sol.png",
        priceUsd: 120,
        valueUsd: 150,
    };

    const bought = {
        mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        amount: 180,
        decimals: 6,
        symbol: "USDC",
        name: "USD Coin",
        logoUri: "https://cdn.example.com/usdc.png",
        priceUsd: 1,
        valueUsd: 180,
    };

    return {
        walletAddress: "wallet-1",
        signature: "swap-signature",
        timestamp: "2026-03-19T12:00:00.000Z",
        slot: 123,
        fee: 5000,
        feePayer: "wallet-1",
        balanceChanges: [sold, bought],
        feeChanges: [],
        sold,
        bought,
        totalValueUsd: 180,
        ...overrides,
    };
}

describe("SwapDetailModal token identity rendering", () => {
    beforeEach(() => {
        const modalRoot = document.createElement("div");
        modalRoot.id = ID_MODAL_ROOT;
        document.body.appendChild(modalRoot);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("renders sold and bought token logos when provided", () => {
        render(
            <SwapDetailModal
                isOpen
                onClose={vi.fn()}
                swap={buildSwap()}
            />,
        );

        expect(screen.getByRole("img", { name: "SOL" })).toBeInTheDocument();
        expect(screen.getByRole("img", { name: "USDC" })).toBeInTheDocument();
    });

    it("falls back to token text when logo is missing", () => {
        const swap = buildSwap({
            sold: {
                mint: "So11111111111111111111111111111111111111112",
                amount: -1,
                decimals: 9,
                symbol: "SOL",
                name: "Solana",
                logoUri: undefined,
            },
            balanceChanges: [
                {
                    mint: "So11111111111111111111111111111111111111112",
                    amount: -1,
                    decimals: 9,
                    symbol: "SOL",
                    name: "Solana",
                    logoUri: undefined,
                },
                {
                    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
                    amount: 150,
                    decimals: 6,
                    symbol: "USDC",
                    name: "USD Coin",
                    logoUri: "https://cdn.example.com/usdc.png",
                },
            ],
        });

        render(
            <SwapDetailModal
                isOpen
                onClose={vi.fn()}
                swap={swap}
            />,
        );

        expect(screen.queryByRole("img", { name: "SOL" })).not.toBeInTheDocument();
        expect(screen.getByText("SOL")).toBeInTheDocument();
    });

    it("handles logo load failure without crashing", () => {
        render(
            <SwapDetailModal
                isOpen
                onClose={vi.fn()}
                swap={buildSwap()}
            />,
        );

        const soldLogo = screen.getByRole("img", { name: "SOL" });
        fireEvent.error(soldLogo);

        expect(screen.queryByRole("img", { name: "SOL" })).not.toBeInTheDocument();
        expect(screen.getByText("SOL")).toBeInTheDocument();
        expect(screen.getByText("Swap Details")).toBeInTheDocument();
    });
});
