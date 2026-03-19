// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TokenIdentityCell } from "./TokenIdentityCell";

describe("TokenIdentityCell", () => {
    it("renders token logo when imageUrl is provided", () => {
        render(
            <TokenIdentityCell
                symbol="SOL"
                fullName="Solana"
                imageUrl="https://cdn.example.com/sol.png"
                imageSize={18}
                showInitialsFallback
            />,
        );

        const img = screen.getByRole("img", { name: "SOL" });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", "https://cdn.example.com/sol.png");
        expect(screen.getByText("SOL")).toBeInTheDocument();
    });

    it("renders text fallback when image is missing", () => {
        render(
            <TokenIdentityCell
                symbol="USDC"
                fullName="USD Coin"
                imageUrl={undefined}
                showInitialsFallback
            />,
        );

        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByText("USDC")).toBeInTheDocument();
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge?.textContent).toBe("US");
    });

    it("falls back gracefully when logo URL fails", () => {
        render(
            <TokenIdentityCell
                symbol="BONK"
                fullName="Bonk"
                imageUrl="https://bad.example.com/broken.png"
                showInitialsFallback
            />,
        );

        const img = screen.getByRole("img", { name: "BONK" });
        fireEvent.error(img);

        expect(screen.queryByRole("img", { name: "BONK" })).not.toBeInTheDocument();
        expect(screen.getByText("BONK")).toBeInTheDocument();
        const badge = document.querySelector('[aria-hidden="true"]');
        expect(badge).toBeInTheDocument();
    });
});
