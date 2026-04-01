import type {
    WalletExchangeCountsOptions,
    WalletExchangeCountsResponse,
    WalletPageInfo,
    WalletSwap,
    WalletSwapsQueryOptions,
    WalletSwapsResponse,
    WalletTimePeriod,
} from "@sv/services/wallet/dtos/walletDataObjects.js";
import {
    DEFAULT_EXCHANGE_LIMIT,
    MAX_EXCHANGE_LIMIT,
    WALLET_TABLE_PAGE_SIZE,
} from "@sv/services/wallet/wallet.constants.js";
import { roundUsd } from "@sv/services/wallet/walletNormalization.utils.js";
import { normalizeCursorValue } from "@sv/services/wallet/walletTime.utils.js";
import { getWalletSwaps } from "@sv/services/wallet/walletTransfersSwaps.service.js";

export type WalletSwapsPageFetcher = (
    address: string,
    options?: WalletSwapsQueryOptions,
) => Promise<WalletSwapsResponse>;

type WalletExchangeAccumulator = {
    name: string;
    deposits: number;
    withdrawals: number;
    depositsVolume: number;
    withdrawalsVolume: number;
};

type WalletExchangePeriod = Exclude<WalletTimePeriod, "24H">;

function normalizeExchangeMetric(rawMetric?: "count" | "volume"): "count" | "volume" {
    return rawMetric === "volume" ? "volume" : "count";
}

function normalizeExchangeBucketToken(value: unknown): string {
    return String(value ?? "").trim().toLowerCase();
}

function toFiniteNonNegativeNumber(value: unknown): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return 0;
    }

    return Math.max(0, parsed);
}

function resolveExchangeBucketFromSwap(swap: WalletSwap): { key: string; name: string } {
    const exchangeName = String(swap.exchange?.name ?? "").trim();
    const exchangeAddress = String(swap.exchange?.address ?? "").trim();
    if (exchangeName || exchangeAddress) {
        return {
            key: `exchange:${normalizeExchangeBucketToken(exchangeName)}:${normalizeExchangeBucketToken(exchangeAddress)}`,
            name: exchangeName || exchangeAddress,
        };
    }

    const pairLabel = String(swap.pair?.label ?? "").trim();
    const pairAddress = String(swap.pair?.address ?? "").trim();
    if (pairLabel || pairAddress) {
        return {
            key: `pair:${normalizeExchangeBucketToken(pairLabel)}:${normalizeExchangeBucketToken(pairAddress)}`,
            name: pairLabel || pairAddress,
        };
    }

    return {
        key: "unknown",
        name: "Unknown",
    };
}

function resolveSwapSideVolumes(swap: WalletSwap): {
    depositsVolume: number;
    withdrawalsVolume: number;
} {
    const hasBoughtLeg = swap.bought != null;
    const hasSoldLeg = swap.sold != null;

    let depositsVolume = toFiniteNonNegativeNumber(swap.bought?.valueUsd);
    let withdrawalsVolume = toFiniteNonNegativeNumber(swap.sold?.valueUsd);

    const hasDepositsVolume = depositsVolume > 0;
    const hasWithdrawalsVolume = withdrawalsVolume > 0;
    const totalValueUsd = toFiniteNonNegativeNumber(swap.totalValueUsd);

    if (totalValueUsd <= 0) {
        return { depositsVolume, withdrawalsVolume };
    }

    if (hasBoughtLeg && hasSoldLeg) {
        if (!hasDepositsVolume && !hasWithdrawalsVolume) {
            depositsVolume = totalValueUsd / 2;
            withdrawalsVolume = totalValueUsd / 2;
            return { depositsVolume, withdrawalsVolume };
        }

        if (!hasDepositsVolume) {
            depositsVolume = Math.max(0, totalValueUsd - withdrawalsVolume);
        }

        if (!hasWithdrawalsVolume) {
            withdrawalsVolume = Math.max(0, totalValueUsd - depositsVolume);
        }

        return { depositsVolume, withdrawalsVolume };
    }

    if (hasBoughtLeg && !hasDepositsVolume) {
        depositsVolume = totalValueUsd;
    }

    if (hasSoldLeg && !hasWithdrawalsVolume) {
        withdrawalsVolume = totalValueUsd;
    }

    return { depositsVolume, withdrawalsVolume };
}

function collapseSwapSources(
    sources: Set<WalletPageInfo["source"]>,
): WalletPageInfo["source"] {
    if (sources.size === 0) {
        return "mixed";
    }

    if (sources.has("mixed")) {
        return "mixed";
    }

    if (sources.size === 1) {
        const [single] = Array.from(sources);
        return single;
    }

    return "mixed";
}

async function collectWalletSwapsForExchangeAggregation(
    address: string,
    transactionLimit: number,
    fetchSwapsPage: WalletSwapsPageFetcher,
): Promise<{
    swaps: WalletSwap[];
    source: WalletPageInfo["source"];
    truncated: boolean;
}> {
    const swaps: WalletSwap[] = [];
    const sources = new Set<WalletPageInfo["source"]>();

    let cursor: string | undefined;
    let hasMore = true;

    while (
        hasMore &&
        swaps.length < transactionLimit
    ) {
        const remainingCapacity = Math.max(1, transactionLimit - swaps.length);
        const pageLimit = Math.min(WALLET_TABLE_PAGE_SIZE, remainingCapacity);
        const page = await fetchSwapsPage(address, {
            limit: pageLimit,
            cursor,
            before: cursor,
        });

        sources.add(page.pageInfo.source);

        for (const swap of page.swaps) {
            swaps.push(swap);

            if (swaps.length >= transactionLimit) {
                break;
            }
        }

        hasMore = Boolean(page.pageInfo.hasMore);
        const nextCursor = normalizeCursorValue(page.pageInfo.nextCursor ?? undefined);
        if (!hasMore || !nextCursor || nextCursor === cursor || page.swaps.length === 0) {
            break;
        }

        cursor = nextCursor;
    }

    const truncated =
        hasMore &&
        (swaps.length >= transactionLimit);

    return {
        swaps,
        source: collapseSwapSources(sources),
        truncated,
    };
}

function normalizeExchangePeriod(rawPeriod?: string): WalletExchangePeriod {
    const normalized = String(rawPeriod ?? "").trim().toUpperCase();
    if (
        normalized === "7D" ||
        normalized === "30D" ||
        normalized === "60D" ||
        normalized === "90D" ||
        normalized === "1Y" ||
        normalized === "ALL"
    ) {
        return normalized === "ALL" ? "All" : (normalized as WalletExchangePeriod);
    }

    return "30D";
}

function normalizeExchangeChain(rawChain?: string): string {
    const normalized = String(rawChain ?? "solana").trim().toLowerCase();
    return normalized || "solana";
}

export async function getWalletExchangeCountsWithFetcher(
    address: string,
    options: WalletExchangeCountsOptions | undefined,
    fetchSwapsPage: WalletSwapsPageFetcher,
): Promise<WalletExchangeCountsResponse> {
    const transactionLimit = Math.min(
        Math.max(Math.floor(options?.limit ?? DEFAULT_EXCHANGE_LIMIT), 1),
        MAX_EXCHANGE_LIMIT,
    );
    const period = normalizeExchangePeriod(options?.period);
    const chain = normalizeExchangeChain(options?.chain);
    const metric = normalizeExchangeMetric(options?.metric);

    const dataset = await collectWalletSwapsForExchangeAggregation(
        address,
        transactionLimit,
        fetchSwapsPage,
    );
    const byBucket = new Map<string, WalletExchangeAccumulator>();
    const dedupe = new Set<string>();
    const walletLower = address.toLowerCase();

    for (const swap of dataset.swaps) {
        const signature = String(swap.signature ?? "").trim().toLowerCase();
        if (!signature) {
            continue;
        }

        const bucket = resolveExchangeBucketFromSwap(swap);
        const dedupeKey = `${walletLower}:${signature}:${bucket.key}`;
        if (dedupe.has(dedupeKey)) {
            continue;
        }
        dedupe.add(dedupeKey);

        const accumulator = byBucket.get(bucket.key) ?? {
            name: bucket.name,
            deposits: 0,
            withdrawals: 0,
            depositsVolume: 0,
            withdrawalsVolume: 0,
        };

        const { depositsVolume, withdrawalsVolume } = resolveSwapSideVolumes(swap);

        const hasBuySide = swap.bought != null || swap.transactionType === "buy";
        const hasSellSide = swap.sold != null || swap.transactionType === "sell";

        if (hasBuySide) {
            accumulator.deposits += 1;
            accumulator.depositsVolume += depositsVolume;
        }

        if (hasSellSide) {
            accumulator.withdrawals += 1;
            accumulator.withdrawalsVolume += withdrawalsVolume;
        }

        byBucket.set(bucket.key, accumulator);
    }

    const exchanges = Array.from(byBucket.values())
        .sort((a, b) => {
            const interactionDiff =
                b.deposits + b.withdrawals - (a.deposits + a.withdrawals);
            if (interactionDiff !== 0) {
                return interactionDiff;
            }

            const volumeDiff =
                b.depositsVolume + b.withdrawalsVolume - (a.depositsVolume + a.withdrawalsVolume);
            if (volumeDiff !== 0) {
                return volumeDiff;
            }

            return a.name.localeCompare(b.name);
        })
        .map((item) => ({
            ...item,
            depositsVolume: roundUsd(item.depositsVolume),
            withdrawalsVolume: roundUsd(item.withdrawalsVolume),
        }));

    return {
        exchanges,
        metadata: {
            period,
            chain,
            metric,
            source: dataset.source,
            limit: transactionLimit,
            truncated: dataset.truncated,
        },
    };
}

export async function getWalletExchangeCounts(
    address: string,
    options?: WalletExchangeCountsOptions,
): Promise<WalletExchangeCountsResponse> {
    return getWalletExchangeCountsWithFetcher(address, options, getWalletSwaps);
}
