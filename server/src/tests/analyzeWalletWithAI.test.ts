import { describe, expect, it, vi, beforeEach } from "vitest";

import { DEFAULT_WALLET_BEHAVIOR_PROFILE } from "../modules/wallet-analysis/utils/walletProfileDefaults.js";

const callOrder: string[] = [];

vi.mock("../modules/wallet-analysis/services/walletAnalysisDataSource.js", () => ({
    getWalletAnalysisTransactions: vi.fn(async (params: { walletAddress: string; limit: number }) => {
        callOrder.push("getWalletAnalysisTransactions");
        expect(params.limit).toBe(300);

        return {
            transactions: [
                {
                    signature: "sig-1",
                    slot: 1,
                    timestamp: 1710000000,
                    type: "SWAP",
                    source: "HELIUS",
                    description: "swap",
                    fee: 5000,
                    feePayer: params.walletAddress,
                    nativeTransfers: [],
                    tokenTransfers: [],
                    accountData: [],
                    events: {},
                    info: {
                        feePayer: params.walletAddress,
                        fee: 5000,
                        slot: 1,
                        timestamp: 1710000000,
                    },
                },
            ],
            source: "CACHE_PLUS_HELIUS",
            warnings: [],
        };
    }),
}));

vi.mock("../modules/wallet-analysis/normalizers/normalizeHeliusTransactions.js", () => ({
    normalizeHeliusTransactions: vi.fn(({ walletAddress }: { walletAddress: string }) => {
        callOrder.push("normalizeHeliusTransactions");

        return [
            {
                id: "event-1",
                walletAddress,
                signature: "sig-1",
                timestamp: "2024-03-09T00:00:00.000Z",
                status: "SUCCESS",
                type: "SWAP",
                direction: "OUT",
                nativeTransfers: [],
                tokenTransfers: [],
                summary: "Swap event",
                rawSource: {
                    provider: "HELIUS",
                    parserVersion: "1.0.0",
                },
                warnings: [],
            },
        ];
    }),
}));

vi.mock("../modules/wallet-analysis/analyzers/buildWalletBehaviorProfile.js", () => ({
    buildWalletBehaviorProfile: vi.fn(({ walletAddress }: { walletAddress: string }) => {
        callOrder.push("buildWalletBehaviorProfile");
        return DEFAULT_WALLET_BEHAVIOR_PROFILE(walletAddress);
    }),
}));

vi.mock("../modules/wallet-analysis/analyzers/enrichProfileWithPersona.js", () => ({
    enrichProfileWithPersona: vi.fn(({ profile }: { profile: any }) => {
        callOrder.push("enrichProfileWithPersona");
        return {
            ...profile,
            persona: {
                ...profile.persona,
                primaryPersona: "DEFI_TRADER",
            },
            evidence: [
                {
                    id: "persona-1",
                    type: "METRIC_THRESHOLD",
                    title: "Observed swaps",
                    description: "The wallet executed swap activity.",
                    relatedSignatures: ["sig-1"],
                    severity: "MEDIUM",
                },
            ],
        };
    }),
}));

vi.mock("../modules/wallet-analysis/analyzers/enrichProfileWithRisk.js", () => ({
    enrichProfileWithRisk: vi.fn(({ profile }: { profile: any }) => {
        callOrder.push("enrichProfileWithRisk");
        return {
            ...profile,
            risk: {
                ...profile.risk,
                riskLevel: "MEDIUM",
                riskScore: 54,
                trustScore: 46,
            },
            evidence: [
                ...(profile.evidence ?? []),
                {
                    id: "risk-1",
                    type: "TRANSACTION_SIGNATURES",
                    title: "Repeated swap signature",
                    description: "The wallet activity was anchored to sig-1.",
                    relatedSignatures: ["sig-1"],
                    severity: "HIGH",
                },
            ],
        };
    }),
}));

vi.mock("../services/wallet/walletAiSummary.service.js", () => ({
    summarizeWalletWithGemini: vi.fn(async ({ profile }: { profile: any }) => {
        callOrder.push("summarizeWalletWithGemini");

        return {
            shortSummary: `Persona ${profile.persona.primaryPersona}`,
            walletPersona: profile.persona.primaryPersona,
            riskSummary: "Medium risk",
            pnlSummary: "PnL unavailable",
            behaviorInsights: [
                {
                    title: "Observed swap",
                    explanation: "Supported by the evidence bundle.",
                    evidenceIds: ["persona-1"],
                },
            ],
            suspiciousFindings: [
                {
                    title: "Signature-linked activity",
                    explanation: "Anchored to sig-1.",
                    severity: "HIGH",
                    evidenceIds: ["risk-1"],
                    relatedSignatures: ["sig-1"],
                },
            ],
            evidenceHighlights: profile.evidence,
            cautionNotes: [],
            confidenceNote: "Deterministic test summary.",
        };
    }),
}));

import { analyzeWalletWithAI } from "../modules/wallet-analysis/services/analyzeWalletWithAI.js";

describe("analyzeWalletWithAI", () => {
    beforeEach(() => {
        callOrder.length = 0;
        vi.clearAllMocks();
    });

    it("runs the wallet analysis pipeline end to end", async () => {
        const result = await analyzeWalletWithAI({
            walletAddress: "8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4",
            transactionLimit: 500,
            language: "en",
            userLevel: "ADVANCED",
            maxSummaryLength: "DETAILED",
        });

        expect(callOrder).toEqual([
            "getWalletAnalysisTransactions",
            "normalizeHeliusTransactions",
            "buildWalletBehaviorProfile",
            "enrichProfileWithPersona",
            "enrichProfileWithRisk",
            "summarizeWalletWithGemini",
        ]);

        expect(result.walletAddress).toBe("8w8oQFfYJ2E2Gd2Pq1H4C9k1o7W3R7Q2J9yYx9h8k1K4");
        expect(result.profile.analysisWindow.transactionLimit).toBe(300);
        expect(result.profile.aiContext.language).toBe("en");
        expect(result.profile.aiContext.userLevel).toBe("ADVANCED");
        expect(result.profile.aiContext.maxSummaryLength).toBe("DETAILED");
        expect(result.profile.evidence).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ relatedSignatures: ["sig-1"] }),
            ]),
        );
        expect(result.aiSummary).not.toHaveProperty("transactions");
        expect(result.aiSummary.suspiciousFindings[0].relatedSignatures).toEqual(["sig-1"]);
        expect(typeof result.generatedAt).toBe("string");
    });
});
