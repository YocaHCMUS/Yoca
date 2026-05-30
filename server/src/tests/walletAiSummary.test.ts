import { describe, expect, it } from "vitest";

import { RISK_CLASSIFICATION_FIXTURE_PROFILE } from "../modules/wallet-analysis/fixtures/riskClassification.fixture.js";
import type { EvidenceBundle, WalletBehaviorProfile } from "../modules/wallet-analysis/types/walletBehaviorProfile.js";
import {
    buildWalletAiInput,
    buildWalletAiSummaryFallback,
    buildWalletAnalystPrompt,
    sanitizeWalletAiSummaryResponse,
    type WalletAISummary,
} from "../services/wallet/walletAiSummary.service.js";

function createTestProfile(): WalletBehaviorProfile {
    const profile = structuredClone(RISK_CLASSIFICATION_FIXTURE_PROFILE);

    const evidence: EvidenceBundle[] = [
        {
            id: "ev_high_sig_2",
            type: "TRANSACTION_SIGNATURES",
            title: "Very high frequency activity",
            description: "Twenty-nine transactions were observed in the busiest hour.",
            relatedSignatures: ["sig-a", "sig-b"],
            value: 29,
            threshold: 20,
            severity: "HIGH",
        },
        {
            id: "ev_high_sig_1",
            type: "TRANSACTION_SIGNATURES",
            title: "Short holding period",
            description: "Most closed trades were held for less than a day.",
            relatedSignatures: ["sig-c"],
            value: 0.82,
            threshold: 0.5,
            severity: "HIGH",
        },
        {
            id: "ev_high_no_sig",
            type: "METRIC_THRESHOLD",
            title: "Negative PnL",
            description: "Realized PnL is negative across the window.",
            value: -500,
            threshold: 0,
            severity: "HIGH",
        },
        {
            id: "ev_medium_sig",
            type: "PNL_RESULT",
            title: "Low win rate",
            description: "Win rate stayed below 45%.",
            relatedSignatures: ["sig-d"],
            value: 0.3,
            threshold: 0.45,
            severity: "MEDIUM",
        },
        {
            id: "ev_medium_no_sig",
            type: "METRIC_THRESHOLD",
            title: "High token diversity",
            description: "The wallet traded many different tokens.",
            relatedTokenMints: ["Mint1", "Mint2"],
            value: 35,
            threshold: 20,
            severity: "MEDIUM",
        },
        {
            id: "ev_low_sig",
            type: "TOKEN_HOLDING",
            title: "Portfolio concentration",
            description: "Top holdings are concentrated.",
            relatedSignatures: ["sig-e"],
            value: 0.8,
            threshold: 0.8,
            severity: "LOW",
        },
        {
            id: "ev_low_no_sig",
            type: "METRIC_THRESHOLD",
            title: "Missing data",
            description: "Some metrics are incomplete.",
            value: 58,
            threshold: 70,
            severity: "LOW",
        },
        {
            id: "ev_extra_high_sig",
            type: "GRAPH_PATTERN",
            title: "Wash trading suspicion",
            description: "Suspicion score is elevated based on graph patterns.",
            relatedSignatures: ["sig-f"],
            value: 84,
            threshold: 50,
            severity: "HIGH",
        },
        {
            id: "ev_extra_medium_sig",
            type: "METRIC_THRESHOLD",
            title: "Burst activity",
            description: "Burst score is above the alert threshold.",
            relatedSignatures: ["sig-g"],
            value: 71,
            threshold: 70,
            severity: "MEDIUM",
        },
    ];

    profile.evidence = evidence;
    profile.risk = {
        ...profile.risk,
        riskScore: 88,
        trustScore: 12,
        riskLevel: "HIGH",
        riskFactors: [
            {
                code: "HIGH_FREQUENCY_ACTIVITY",
                severity: "HIGH",
                scoreImpact: 20,
                description: "High frequency activity detected.",
                evidenceIds: ["ev_high_sig_2"],
            },
            {
                code: "SHORT_HOLDING_PERIOD",
                severity: "HIGH",
                scoreImpact: 18,
                description: "Short holding period detected.",
                evidenceIds: ["ev_high_sig_1"],
            },
            {
                code: "NEGATIVE_PNL",
                severity: "MEDIUM",
                scoreImpact: 12,
                description: "Negative realized PnL detected.",
                evidenceIds: ["ev_high_no_sig"],
            },
        ],
        explanation: "Test risk explanation.",
    };

    return profile;
}

describe("walletAiSummary", () => {
    it("builds evidence-aware input and prompt", () => {
        const profile = createTestProfile();
        const input = buildWalletAiInput(profile);
        const prompt = buildWalletAnalystPrompt(input);

        expect(input.evidenceHighlights).toHaveLength(8);
        expect(input.evidenceHighlights[0].evidenceId).toBe("ev_high_sig_2");
        expect(input.evidenceHighlights.map((highlight) => highlight.evidenceId)).toEqual(
            expect.arrayContaining(["ev_high_sig_1", "ev_extra_high_sig", "ev_medium_sig"]),
        );
        expect(prompt).toContain("Do not create new evidence IDs.");
        expect(prompt).toContain("suspiciousFindings.relatedSignatures must be copied only from the provided evidenceHighlights.relatedSignatures.");
        expect(prompt).toContain("ev_high_sig_2");
    });

    it("returns the deterministic fallback for invalid Gemini output", () => {
        const profile = createTestProfile();
        const input = buildWalletAiInput(profile);
        const fallback = buildWalletAiSummaryFallback(profile);
        const sanitized = sanitizeWalletAiSummaryResponse({ shortSummary: 123, behaviorInsights: [] }, input);

        expect(sanitized).toEqual(fallback);
        expect(sanitized.cautionNotes).toContain(
            "Risk score reflects observed behavior in the analyzed transaction window. It is not a legal, financial, or fraud verdict.",
        );
        expect(sanitized.evidenceHighlights).toHaveLength(8);
    });

    it("cleans unknown evidence IDs from Gemini output", () => {
        const profile = createTestProfile();
        const input = buildWalletAiInput(profile);

        const response: WalletAISummary = {
            shortSummary: "Valid enough to parse.",
            walletPersona: profile.persona.primaryPersona,
            riskSummary: "Risk is elevated.",
            pnlSummary: "PnL is negative.",
            behaviorInsights: [
                {
                    title: "Valid insight",
                    explanation: "This refers to a known evidence item.",
                    evidenceIds: ["ev_high_sig_1", "unknown_evidence_id"],
                },
            ],
            suspiciousFindings: [
                {
                    title: "Valid finding",
                    explanation: "This refers to a known evidence item.",
                    severity: "HIGH",
                    evidenceIds: ["ev_high_sig_2", "unknown_evidence_id"],
                    relatedSignatures: ["sig-a", "fake-signature"],
                },
            ],
            evidenceHighlights: input.evidenceHighlights,
            cautionNotes: [],
            confidenceNote: "Confidence note.",
        };

        const sanitized = sanitizeWalletAiSummaryResponse(response, input);

        expect(sanitized.behaviorInsights[0].evidenceIds).toEqual(["ev_high_sig_1"]);
        expect(sanitized.suspiciousFindings[0].evidenceIds).toEqual(["ev_high_sig_2"]);
        expect(sanitized.suspiciousFindings[0].relatedSignatures).toEqual(["sig-a"]);
    });

    it("cleans invented signatures from Gemini output", () => {
        const profile = createTestProfile();
        const input = buildWalletAiInput(profile);

        const response: WalletAISummary = {
            shortSummary: "Valid enough to parse.",
            walletPersona: profile.persona.primaryPersona,
            riskSummary: "Risk is elevated.",
            pnlSummary: "PnL is negative.",
            behaviorInsights: [
                {
                    title: "Valid insight",
                    explanation: "This uses valid evidence.",
                    evidenceIds: ["ev_high_sig_1"],
                },
            ],
            suspiciousFindings: [
                {
                    title: "Invented signature test",
                    explanation: "This uses an invented signature.",
                    severity: "HIGH",
                    evidenceIds: ["ev_high_sig_2"],
                    relatedSignatures: ["sig-b", "invented-signature"],
                },
            ],
            evidenceHighlights: input.evidenceHighlights,
            cautionNotes: [],
            confidenceNote: "Confidence note.",
        };

        const sanitized = sanitizeWalletAiSummaryResponse(response, input);

        expect(sanitized.suspiciousFindings[0].relatedSignatures).toEqual(["sig-b"]);
        expect(sanitized.suspiciousFindings[0].evidenceIds).toEqual(["ev_high_sig_2"]);
    });
});