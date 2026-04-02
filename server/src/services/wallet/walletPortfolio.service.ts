import { WALLET_PORTFOLIO_TTL_MS } from "@sv/config/constants.js";
import type { PnLDataPoint, PriceTimelinePoint, WalletPortfolioItem, WalletTransactionHelius } from "./dtos/walletDataObjects.js";
import { buildSnapshotTimestamps, calculatePortfolioValueUsd, enrichWalletPortfolioMetadata, normalizeMint, normalizePriceTimeline, toCurrentPriceFallback } from "./walletData.core.js";
import { normalizeBalanceDelta, roundUsd } from "./walletNormalization.utils.js";
import { db } from "@sv/db/index.js";
import { walletPortfolioCache } from "@sv/db/schema.js";
import { and, eq } from "drizzle-orm";
import { getHourlyTokenMarketChart, getDailyTokenMarketChart } from "../tokens/token-chart.js";
import { getTokenMarketData } from "../tokens/token-market-data.js";
import { fetchBirdeyePortfolio } from "./fetchers/walletDataFetcher.service.js";
import { DAY_MS } from "./wallet.constants.js";
import { parseTimestampMs } from "./walletTime.utils.js";
import { getWalletTransactionHelius } from "./walletHistory.service.js";

export async function getWalletPortfolio(
    address: string,
): Promise<WalletPortfolioItem[]> {
    // 0) DB-first: use cached portfolio if fresh
    const portfolioThreshold = new Date(Date.now() - WALLET_PORTFOLIO_TTL_MS);
    const cachedPortfolio = await db
        .select()
        .from(walletPortfolioCache)
        .where(
            and(
                eq(walletPortfolioCache.address, address)
            ),
        )
        .limit(1);
    if (cachedPortfolio.length > 0 && cachedPortfolio[0].fetchedAt >= portfolioThreshold) {
        const cachedData = (cachedPortfolio[0].data as WalletPortfolioItem[]) ?? [];
        if (cachedData.length > 0) {
            const enrichedCached = await enrichWalletPortfolioMetadata(cachedData, {
                address,
                source: "cache-hit",
            });

            if (enrichedCached.changed) {

                await db
                    .insert(walletPortfolioCache)
                    .values({ address, data: enrichedCached.portfolio })
                    .onConflictDoUpdate({
                        target: [walletPortfolioCache.address],
                        set: { data: enrichedCached.portfolio, fetchedAt: new Date() },
                    });
            }

            return enrichedCached.portfolio;
        }
        // If cached portfolio is empty (likely from an earlier failed API call),
        // fall through to external fetch instead of treating it as valid.
    }

    let selectedPortfolio: WalletPortfolioItem[] = [];
    let selectedSource: "birdeye" | "helius" | "none" = "none";
    try {
        const birdeyePortfolio = await fetchBirdeyePortfolio(address);
        if (
            birdeyePortfolio.items.length > 0 ||
            Number(birdeyePortfolio.totalAssetValueUsd ?? 0) > 0
        ) {
            selectedPortfolio = birdeyePortfolio.items;
            selectedSource = "birdeye";
        }
    } catch (err) {
        console.error("Failed to fetch Solana portfolio from Birdeye", err);
    }

    if (selectedPortfolio.length === 0) {
        return [];
    }

    const enrichedPortfolio = await enrichWalletPortfolioMetadata(selectedPortfolio, {
        address,
        source: selectedSource,
    });

    await db
        .insert(walletPortfolioCache)
        .values({ address, data: enrichedPortfolio.portfolio })
        .onConflictDoUpdate({
            target: [walletPortfolioCache.address],
            set: { data: enrichedPortfolio.portfolio, fetchedAt: new Date() },
        });
    return enrichedPortfolio.portfolio;
}

export async function getHistoricalPortfolioValueSeries(
    address: string,
    startMs: number,
    endMs: number,
    intervalMs: number,
    options?: {
        beforeCursor?: string;
        transactionLimit?: number;
        onTransactionsLoaded?: (transactions: WalletTransactionHelius[]) => void;
    },
): Promise<PnLDataPoint[]> {
    const snapshots = buildSnapshotTimestamps(startMs, endMs, intervalMs);
    const requestedFromSec = Math.floor(startMs / 1000);
    const requestedToSec = Math.floor(endMs / 1000);

    const [portfolio, txResponse] = await Promise.all([
        getWalletPortfolio(address),
        getWalletTransactionHelius(address, {
            fromSec: requestedFromSec,
            toSec: requestedToSec,
            before: options?.beforeCursor,
            limit: options?.transactionLimit,
        }),
    ]);

    const balances = new Map<string, number>();
    const tokenAddresses = new Set<string>();

    for (const item of portfolio) {
        const tokenAddress = normalizeMint(item.tokenAddress);
        if (!tokenAddress) {
            continue;
        }

        const amount = Number(item.amount ?? 0);
        if (!Number.isFinite(amount)) {
            continue;
        }

        const nextAmount = (balances.get(tokenAddress) ?? 0) + amount;
        if (Math.abs(nextAmount) < 1e-12) {
            balances.delete(tokenAddress);
        } else {
            balances.set(tokenAddress, nextAmount);
        }
        tokenAddresses.add(tokenAddress);
    }

    const transactions = txResponse.transactions
        .filter((tx) => {
            const timestampMs = parseTimestampMs(tx.timestamp);
            return timestampMs >= startMs && timestampMs <= endMs;
        })
        .sort((a, b) => parseTimestampMs(b.timestamp) - parseTimestampMs(a.timestamp));

    options?.onTransactionsLoaded?.(transactions);

    for (const tx of transactions) {
        for (const change of tx.balanceChanges ?? []) {
            const tokenAddress = normalizeMint(change?.mint);
            if (!tokenAddress) {
                continue;
            }
            tokenAddresses.add(tokenAddress);
        }
    }

    if (tokenAddresses.size === 0) {
        return snapshots.map((timestamp) => ({
            timestamp,
            value: 0,
        }));
    }

    const tokenAddressList = Array.from(tokenAddresses);
    const daysSpan = Math.max(
        1,
        Math.min(365, Math.ceil((endMs - startMs) / DAY_MS) + 2),
    );
    const useHourlyChart = daysSpan <= 90;

    const [currentMarketData, priceTimelineEntries] = await Promise.all([
        getTokenMarketData(tokenAddressList),
        Promise.all(
            tokenAddressList.map(async (tokenAddress) => {
                const chartRows = useHourlyChart
                    ? await getHourlyTokenMarketChart(tokenAddress, daysSpan)
                    : await getDailyTokenMarketChart(tokenAddress, daysSpan);

                const timeline = normalizePriceTimeline(
                    chartRows.map((row) => ({
                        unixTimestampMs: row.unixTimestampMs,
                        price: row.price,
                    })),
                );

                return [tokenAddress, timeline] as const;
            }),
        ),
    ]);

    const timelinesByToken = new Map<string, PriceTimelinePoint[]>(
        priceTimelineEntries,
    );
    const currentPriceFallback = toCurrentPriceFallback(currentMarketData);

    const snapshotsDescending = [...snapshots].sort((a, b) => b - a);
    const portfolioValuesDescending: PnLDataPoint[] = [];
    let txIndex = 0;

    for (const snapshotMs of snapshotsDescending) {
        while (txIndex < transactions.length) {
            const tx = transactions[txIndex];
            const txTimestampMs = parseTimestampMs(tx.timestamp);
            if (txTimestampMs <= snapshotMs) {
                break;
            }

            for (const change of tx.balanceChanges ?? []) {
                const tokenAddress = normalizeMint(change?.mint);
                if (!tokenAddress) {
                    continue;
                }

                const balanceDelta = normalizeBalanceDelta({
                    amount: Number(change?.amount ?? 0),
                    decimals: Number(change?.decimals ?? 0),
                });

                if (!Number.isFinite(balanceDelta) || balanceDelta === 0) {
                    continue;
                }

                const previousAmount = (balances.get(tokenAddress) ?? 0) - balanceDelta;
                if (Math.abs(previousAmount) < 1e-12) {
                    balances.delete(tokenAddress);
                } else {
                    balances.set(tokenAddress, previousAmount);
                }
            }

            txIndex += 1;
        }

        const portfolioValueUsd = calculatePortfolioValueUsd(
            balances,
            timelinesByToken,
            currentPriceFallback,
            snapshotMs,
        );

        portfolioValuesDescending.push({
            timestamp: snapshotMs,
            value: roundUsd(Math.max(0, portfolioValueUsd)),
        });
    }

    return portfolioValuesDescending.reverse();
}