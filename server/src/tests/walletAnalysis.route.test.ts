import { describe, expect, it, vi } from "vitest";

const { analyzeWalletWithAIMock } = vi.hoisted(() => ({
    analyzeWalletWithAIMock: vi.fn(),
}));

vi.mock("../modules/wallet-analysis/services/analyzeWalletWithAI.js", () => ({
    analyzeWalletWithAI: analyzeWalletWithAIMock,
}));

import walletAnalysisRoute from "../modules/wallet-analysis/routes/walletAnalysis.routes.js";

describe("walletAnalysis route", () => {
    it("returns INVALID_WALLET_ADDRESS for malformed addresses", async () => {
        const response = await walletAnalysisRoute.request("/analyze", {
            method: "POST",
            body: JSON.stringify({ walletAddress: "not-a-wallet" }),
            headers: {
                "content-type": "application/json",
            },
        });

        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
            success: false,
            error: {
                code: "INVALID_WALLET_ADDRESS",
                message: "Wallet address is invalid.",
            },
        });
        expect(analyzeWalletWithAIMock).not.toHaveBeenCalled();
    });

    it("returns the analyzed wallet payload for a valid request", async () => {
        analyzeWalletWithAIMock.mockResolvedValueOnce({
            walletAddress: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4",
            profile: {
                wallet: { address: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4" },
                evidence: [],
            },
            aiSummary: {
                shortSummary: "Mock summary",
            },
            generatedAt: "2024-03-09T00:00:00.000Z",
        });

        const response = await walletAnalysisRoute.request("/analyze", {
            method: "POST",
            body: JSON.stringify({ walletAddress: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4" }),
            headers: {
                "content-type": "application/json",
            },
        });

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            success: true,
            data: {
                walletAddress: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4",
                profile: {
                    wallet: { address: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4" },
                    evidence: [],
                },
                aiSummary: {
                    shortSummary: "Mock summary",
                },
                generatedAt: "2024-03-09T00:00:00.000Z",
            },
        });
        expect(analyzeWalletWithAIMock).toHaveBeenCalledTimes(1);
    });
});