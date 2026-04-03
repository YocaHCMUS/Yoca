import type {
    WalletFirstFundInsight,
} from "@sv/services/wallet/dtos/walletIdentityObjects.js";
import {
    computeWalletAgeDays,
    formatWalletAgeLabel,
    parseTimestampSec,
} from "@sv/services/wallet/walletTime.utils.js";
import type { HeliusWalletFirstFund } from "@sv/services/wallet/dtos/walletDataObjects.js";

function normalizeString(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function shortenWalletAddress(address: string): string {
    const normalized = address.trim();

    if (normalized.length <= 14) {
        return normalized;
    }

    return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
}

export function buildWalletFirstFundInsight(
    targetAddress: string,
    firstFund: HeliusWalletFirstFund | null,
    nowMs: number = Date.now(),
): WalletFirstFundInsight | null {
    console.log("Building wallet first fund insight for", targetAddress, "with first fund data", firstFund);

    if (firstFund == null) {
        return null;
    }

    const funderAddress = normalizeString(firstFund.funder);
    const funderName = normalizeString(firstFund.funderName);
    const funderType = normalizeString(firstFund.funderType);
    const firstFundDate = normalizeString(firstFund.date);
    const signature = normalizeString(firstFund.signature);
    const firstFundTimestampSec =
        parseTimestampSec(firstFund.timestamp) ??
        (firstFundDate != null ? parseTimestampSec(firstFundDate) : null);
    const walletAgeDays =
        firstFundTimestampSec != null
            ? computeWalletAgeDays(firstFundTimestampSec, nowMs)
            : null;
    const walletAgeLabel =
        walletAgeDays != null
            ? formatWalletAgeLabel(walletAgeDays)
            : null;

    return {
        targetAddress: targetAddress.trim(),
        funderAddress,
        funderName,
        funderType,
        funderLabel: funderName ?? (funderAddress != null ? shortenWalletAddress(funderAddress) : null),
        firstFundDate,
        firstFundTimestampSec,
        walletAgeDays,
        walletAgeLabel,
        signature,
    };
}