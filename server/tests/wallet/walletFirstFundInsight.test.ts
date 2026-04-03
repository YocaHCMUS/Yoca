import { describe, expect, it } from "vitest";
import { buildWalletFirstFundInsight } from "@sv/services/wallet/walletFirstFundInsight.js";

describe("buildWalletFirstFundInsight", () => {
    it("normalizes provider payloads into display fields", () => {
        const nowMs = Date.UTC(2026, 3, 3);
        const firstFundTimestampSec = Math.floor((nowMs - 400 * 24 * 60 * 60 * 1000) / 1000);
        const insight = buildWalletFirstFundInsight(
            "TargetWallet1111111111111111111111111111111111",
            {
                reciepient: "TargetWallet1111111111111111111111111111111111",
                funder: "FunderWallet111111111111111111111111111111111",
                funderName: "Alpha Fund",
                funderType: "team",
                mint: "SOL",
                symbol: "SOL",
                amount: 1,
                amountRaw: "1000000000",
                decimals: 9,
                date: new Date(firstFundTimestampSec * 1000).toISOString(),
                signature: "sig-123",
                timestamp: firstFundTimestampSec,
                slot: 1,
                explorerUrl: "https://example.com",
            },
            nowMs,
        );

        expect(insight).toEqual({
            targetAddress: "TargetWallet1111111111111111111111111111111111",
            funderAddress: "FunderWallet111111111111111111111111111111111",
            funderName: "Alpha Fund",
            funderType: "team",
            funderLabel: "Alpha Fund",
            firstFundDate: new Date(firstFundTimestampSec * 1000).toISOString(),
            firstFundTimestampSec,
            walletAgeDays: 400,
            walletAgeLabel: "1y 1m",
            signature: "sig-123",
        });
    });

    it("returns null for empty provider payloads", () => {
        expect(
            buildWalletFirstFundInsight(
                "TargetWallet1111111111111111111111111111111111",
                {
                    reciepient: "TargetWallet1111111111111111111111111111111111",
                    funder: "   ",
                    funderName: "",
                    funderType: "",
                    mint: "SOL",
                    symbol: "SOL",
                    amount: 1,
                    amountRaw: "1000000000",
                    decimals: 9,
                    date: "",
                    signature: "",
                    timestamp: Number.NaN,
                    slot: 1,
                    explorerUrl: "https://example.com",
                },
            ),
        ).toBeNull();
    });
});