import { mapWithConcurrency } from "@sv/util/concurrency.js";
import { getTokenHistoricalData } from "@sv/services/tokens/token-history.js";
import { getTokenMarketData } from "@sv/services/tokens/token-market-data.js";
import type { TokenBalanceSeriesResult, BalanceDataPoint } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { toFiniteNumber } from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { SOL_MINT, TOKEN_BALANCE_SNAPSHOT_CONCURRENCY, DAY_MS, DAY_SEC, TOKEN_BALANCE_SNAPSHOT_CACHE_HISTORICAL_TTL_MS, TOKEN_BALANCE_SNAPSHOT_CACHE_RECENT_TTL_MS } from "@sv/services/wallet/wallet.constants.js";
import { type WalletTimePeriod, normalizeMint, isSolSymbol, getDailySnapshotSecRange, toIsoFromSec } from "@sv/services/wallet/walletData.core.js";
import { getWalletTransactionHelius } from "@sv/services/wallet/walletHistory.service.js";
import { fetchBirdeyePortfolioSnapshot } from "./fetchers/walletDataFetcher.service.js";
import { getWalletPortfolio } from "./walletPortfolio.service.js";

type CachedPortfolioSnapshot = {
    expiresAtMs: number;
    snapshot: Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>>;
};

const tokenBalanceSnapshotCache = new Map<string, CachedPortfolioSnapshot>();

export async function getWalletTokenBalanceHistory(
    address: string,
    tokenSelector: string,
    timePeriod: WalletTimePeriod = "30D"
): Promise<TokenBalanceSeriesResult> {
    const now = new Date();
    let startDate = new Date(now);
    switch (timePeriod) {
        case "7D": startDate.setDate(now.getDate() - 7); break;
        case "30D": startDate.setDate(now.getDate() - 30); break;
        case "60D": startDate.setDate(now.getDate() - 60); break;
        case "90D": startDate.setDate(now.getDate() - 90); break;
        case "1Y": startDate.setFullYear(now.getFullYear() - 1); break;
        case "All": startDate = new Date(0); break;
    }

    const flatZero = (): TokenBalanceSeriesResult => ({
        tokenSeries: [
            { timestamp: startDate.getTime(), value: 0, date: startDate.toISOString() },
            { timestamp: now.getTime(), value: 0, date: now.toISOString() },
        ],
        usdSeries: [
            { timestamp: startDate.getTime(), value: 0, date: startDate.toISOString() },
            { timestamp: now.getTime(), value: 0, date: now.toISOString() },
        ],
        tokenSymbol: tokenSelector,
        tokenAddress: "",
    });

    const requestedFromSec = Math.floor(startDate.getTime() / 1000);
    const requestedToSec = Math.floor(now.getTime() / 1000);
    const selectorLower = tokenSelector.trim().toLowerCase();

    try {
        const portfolio = await getWalletPortfolio(address);
        const resolvedItem = portfolio.find(
            (item) =>
                item.tokenAddress.toLowerCase() === selectorLower ||
                item.symbol.toLowerCase() === selectorLower ||
                (selectorLower === "sol" && item.tokenAddress === SOL_MINT),
        );

        const resolvedMint = resolvedItem
            ? (isSolSymbol(resolvedItem.symbol) || selectorLower === "sol"
                ? SOL_MINT
                : normalizeMint(resolvedItem.tokenAddress))
            : selectorLower === "sol"
                ? SOL_MINT
                : normalizeMint(tokenSelector);

        if (resolvedMint) {
            const resolvedSymbol = resolvedItem?.symbol || tokenSelector;
            const daySecList = getDailySnapshotSecRange(requestedFromSec, requestedToSec);

            const dailySnapshots = await mapWithConcurrency(
                daySecList,
                TOKEN_BALANCE_SNAPSHOT_CONCURRENCY,
                async (daySec) => {
                    try {
                        const snapshot = await getBirdeyePortfolioSnapshotCached(address, daySec, requestedToSec);
                        return { daySec, snapshot, error: null };
                    } catch (error) {
                        return { daySec, snapshot: null, error };
                    }
                },
            );

            const tokenSeries: BalanceDataPoint[] = [];
            const usdSeries: BalanceDataPoint[] = [];
            let matchedSnapshotPoints = 0;

            for (const entry of dailySnapshots) {
                const timestamp = entry.daySec * 1000;
                const date = new Date(timestamp).toISOString();

                if (!entry.snapshot) {
                    tokenSeries.push({ timestamp, value: 0, date });
                    usdSeries.push({ timestamp, value: 0, date });
                    continue;
                }

                const matchedAsset = entry.snapshot.assets.find((asset) => {
                    const assetMint = normalizeMint(asset.tokenAddress);
                    if (assetMint && assetMint === resolvedMint) {
                        return true;
                    }

                    return resolvedMint === SOL_MINT && isSolSymbol(asset.symbol);
                });

                if (!matchedAsset) {
                    tokenSeries.push({ timestamp, value: 0, date });
                    usdSeries.push({ timestamp, value: 0, date });
                    continue;
                }

                matchedSnapshotPoints += 1;

                const balanceRaw = Number(matchedAsset.balanceRaw ?? Number.NaN);
                const decimals = Number(matchedAsset.decimals ?? 0);
                const tokenAmount =
                    Number.isFinite(balanceRaw) && Number.isFinite(decimals)
                        ? balanceRaw / 10 ** Math.max(0, decimals)
                        : 0;

                const usdValue = toFiniteNumber(
                    matchedAsset.valueUsd,
                    tokenAmount * toFiniteNumber(matchedAsset.priceUsd, 0),
                );

                tokenSeries.push({ timestamp, value: Math.max(0, tokenAmount), date });
                usdSeries.push({ timestamp, value: Math.max(0, usdValue), date });
            }

            if (matchedSnapshotPoints > 0) {
                console.log("[wallet-token-balance-history-snapshot]", {
                    address,
                    tokenAddress: resolvedMint,
                    requestedRange: { fromSec: requestedFromSec, toSec: requestedToSec },
                    daysRequested: daySecList.length,
                    matchedSnapshotPoints,
                    source: "birdeye-portfolio-snapshot",
                });

                return {
                    tokenSeries,
                    usdSeries,
                    tokenSymbol: resolvedSymbol,
                    tokenAddress: resolvedMint,
                };
            }
        }
    } catch (snapshotErr) {
        console.warn("[getWalletTokenBalanceHistory] Snapshot path failed; falling back", {
            address,
            tokenSelector,
            timePeriod,
            error: snapshotErr,
        });
    }

    try {
        const portfolio = await getWalletPortfolio(address);

        const resolvedItem = portfolio.find(
            (item) =>
                item.tokenAddress.toLowerCase() === selectorLower ||
                item.symbol.toLowerCase() === selectorLower ||
                (selectorLower === "sol" && item.tokenAddress === SOL_MINT)
        );

        if (!resolvedItem) {
            return flatZero();
        }

        const resolvedMint =
            isSolSymbol(resolvedItem.symbol) || selectorLower === "sol"
                ? SOL_MINT
                : normalizeMint(resolvedItem.tokenAddress);
        if (!resolvedMint) {
            return flatZero();
        }

        const resolvedSymbol = resolvedItem.symbol || tokenSelector;
        const currentTokenBalance = resolvedItem.amount ?? 0;
        const txResponse = await getWalletTransactionHelius(address, {
            fromSec: requestedFromSec,
        });
        const transactions = txResponse.transactions;

        const relevantTxs = transactions
            .filter((tx) => {
                const txDate = new Date(tx.timestamp);
                return txDate >= startDate && txDate <= now;
            })
            .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const marketData = await getTokenMarketData([resolvedMint]);
        const currentPriceRaw = Number(marketData[resolvedMint]?.priceUsd ?? Number.NaN);
        const currentPrice = Number.isFinite(currentPriceRaw) && currentPriceRaw > 0
            ? currentPriceRaw
            : 0;

        const daysSpan = Math.max(
            1,
            Math.min(3650, Math.ceil((now.getTime() - startDate.getTime()) / DAY_MS) + 2),
        );

        let historicalPriceTimeline: Array<{ timestampSec: number; price: number }> = [];
        try {
            const historicalData = await getTokenHistoricalData(resolvedMint, daysSpan);
            historicalPriceTimeline = (historicalData ?? [])
                .map((point) => ({
                    timestampSec: Math.floor(point.timestampMs / 1000),
                    price: Number(point.price ?? Number.NaN),
                }))
                .filter((point) => Number.isFinite(point.price) && point.price > 0)
                .sort((a, b) => a.timestampSec - b.timestampSec);
        } catch (historyErr) {
            console.error("[getWalletTokenBalanceHistory] Failed to fetch historical prices", historyErr);
        }

        const tokenBalanceHistory: BalanceDataPoint[] = [];

        if (relevantTxs.length === 0) {
            tokenBalanceHistory.push(
                { timestamp: startDate.getTime(), value: currentTokenBalance, date: startDate.toISOString() },
                { timestamp: now.getTime(), value: currentTokenBalance, date: now.toISOString() },
            );
        } else {
            let runningTokenBalance = currentTokenBalance;
            const reversedTxs = [...relevantTxs].reverse();

            for (const tx of reversedTxs) {
                const txDate = new Date(tx.timestamp);
                let tokenDelta = 0;

                for (const change of tx.balanceChanges ?? []) {
                    const canonicalMint = normalizeMint(change?.mint);
                    if (!canonicalMint || canonicalMint !== resolvedMint) {
                        continue;
                    }

                    const amountRaw = Number(change?.amount ?? 0);
                    const decimals = Number(change?.decimals ?? 0);
                    if (!Number.isFinite(amountRaw) || !Number.isFinite(decimals)) {
                        continue;
                    }

                    tokenDelta += amountRaw / 10 ** Math.max(0, decimals);
                }

                runningTokenBalance -= tokenDelta;
                tokenBalanceHistory.unshift({
                    timestamp: txDate.getTime(),
                    value: Math.max(0, runningTokenBalance),
                    date: txDate.toISOString(),
                });
            }

            tokenBalanceHistory.push({
                timestamp: now.getTime(),
                value: Math.max(0, currentTokenBalance),
                date: now.toISOString(),
            });
        }

        const tokenSeries: BalanceDataPoint[] = [];
        const usdSeries: BalanceDataPoint[] = [];
        let priceCursor = 0;
        let latestHistoricalPrice: number | null = null;
        let historicalPricedPoints = 0;
        let fallbackPricedPoints = 0;

        for (let date = new Date(startDate); date <= now; date = new Date(date.getTime() + DAY_MS)) {
            const timestamp = date.getTime();
            let closestTokenBalance = tokenBalanceHistory[0]?.value ?? currentTokenBalance;
            for (const point of tokenBalanceHistory) {
                if (point.timestamp <= timestamp) {
                    closestTokenBalance = point.value;
                } else {
                    break;
                }
            }

            tokenSeries.push({ timestamp, value: closestTokenBalance, date: date.toISOString() });

            const pointSec = Math.floor(timestamp / 1000);
            while (
                priceCursor < historicalPriceTimeline.length &&
                historicalPriceTimeline[priceCursor].timestampSec <= pointSec
            ) {
                latestHistoricalPrice = historicalPriceTimeline[priceCursor].price;
                priceCursor += 1;
            }

            const appliedPrice = latestHistoricalPrice ?? currentPrice;
            if (latestHistoricalPrice != null) {
                historicalPricedPoints += 1;
            } else {
                fallbackPricedPoints += 1;
            }

            usdSeries.push({
                timestamp,
                value: closestTokenBalance * appliedPrice,
                date: date.toISOString(),
            });
        }

        console.log("[wallet-token-balance-history-price]", {
            address,
            tokenAddress: resolvedMint,
            requestedRange: { fromSec: requestedFromSec, toSec: Math.floor(now.getTime() / 1000) },
            historicalPricePoints: historicalPriceTimeline.length,
            historicalPricedPoints,
            fallbackPricedPoints,
        });

        return { tokenSeries, usdSeries, tokenSymbol: resolvedSymbol, tokenAddress: resolvedMint };
    } catch (err) {
        console.error("[getWalletTokenBalanceHistory] Error:", err);
        return flatZero();
    }
}


async function getBirdeyePortfolioSnapshotCached(
    address: string,
    daySec: number,
    nowSec: number,
): Promise<Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>>> {
    const cacheKey = buildTokenSnapshotCacheKey(address, daySec);
    const nowMs = Date.now();
    const cached = tokenBalanceSnapshotCache.get(cacheKey);

    if (cached && cached.expiresAtMs > nowMs) {
        return cached.snapshot;
    }

    const snapshot = await fetchBirdeyePortfolioSnapshot(address, {
        time: toIsoFromSec(daySec),
    });

    const ttlMs = getTokenSnapshotCacheTtlMs(daySec, nowSec);
    tokenBalanceSnapshotCache.set(cacheKey, {
        expiresAtMs: nowMs + ttlMs,
        snapshot,
    });

    return snapshot;
}

function buildTokenSnapshotCacheKey(address: string, daySec: number): string {
    return `${address.toLowerCase()}:${daySec}`;
}

function getTokenSnapshotCacheTtlMs(daySec: number, nowSec: number): number {
    const ageSec = Math.max(0, nowSec - daySec);
    return ageSec <= DAY_SEC
        ? TOKEN_BALANCE_SNAPSHOT_CACHE_RECENT_TTL_MS
        : TOKEN_BALANCE_SNAPSHOT_CACHE_HISTORICAL_TTL_MS;
}
