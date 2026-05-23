import { heliusGetJson } from "../../../services/wallet/providers/helius.client.js";
import type { HeliusEnhancedTransactionLike } from "../types/normalizedWalletEvent.js";

const HELIUS_PAGE_SIZE = 100;

function normalizeLimit(limit: number): number {
    return Math.min(Math.max(Math.floor(limit), 1), 300);
}

function normalizePageSize(limit: number): number {
    return Math.min(limit, HELIUS_PAGE_SIZE);
}

export async function fetchWalletTransactions(params: {
    walletAddress: string;
    limit: number;
}): Promise<HeliusEnhancedTransactionLike[]> {
    const targetLimit = normalizeLimit(params.limit);
    const pageSize = normalizePageSize(targetLimit);

    const collected: HeliusEnhancedTransactionLike[] = [];
    let before: string | undefined;

    while (collected.length < targetLimit) {
        const page = await heliusGetJson<HeliusEnhancedTransactionLike[]>(
            `/v0/addresses/${params.walletAddress}/transactions`,
            {
                limit: pageSize,
                before,
            },
        );

        if (!Array.isArray(page) || page.length === 0) {
            break;
        }

        collected.push(...page);
        if (page.length < pageSize) {
            break;
        }

        before = page[page.length - 1]?.signature;
        if (!before) {
            break;
        }
    }

    return collected.slice(0, targetLimit);
}