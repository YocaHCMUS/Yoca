import { mapWithConcurrency } from "@sv/util/concurrency.js";
import type { TokenBalanceSeriesResult, BalanceDataPoint, WalletTimePeriod } from "@sv/services/wallet/dtos/walletDataObjects.js";
import { toFiniteNumber } from "@sv/services/wallet/fetchers/walletProviderMappers.js";
import { SOL_MINT, TOKEN_BALANCE_SNAPSHOT_CONCURRENCY, DAY_MS } from "@sv/services/wallet/wallet.constants.js";
import { normalizeMint, isSolSymbol, toIsoFromSec } from "@sv/services/wallet/walletData.core.js";
import { getCachedWalletTokenBalanceHistory, saveWalletTokenBalanceHistoryCache } from "@sv/services/wallet/db/walletTokenBalanceHistoryCache.js";
import { fetchBirdeyePortfolioSnapshot } from "./fetchers/walletDataFetcher.service.js";
import { getWalletPortfolio } from "./walletPortfolio.service.js";
import { resolveWalletTimeRangeSec } from "./walletCharts.service.js";

export async function getWalletTokenBalanceHistory(
    address: string,
    tokenSelector: string,
    timePeriod: WalletTimePeriod = "30D",
): Promise<TokenBalanceSeriesResult> {
    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    const rangeSec = resolveWalletTimeRangeSec(timePeriod, nowSec);

    // Build day-aligned timestamps starting from the exact range start (no UTC snapping)
    const historicalDayStartMs = buildHistoricalDayStartMsList(rangeSec.fromSec * 1000, nowMs);
    const historicalFromMs = historicalDayStartMs[0];
    const historicalToMs = historicalDayStartMs[historicalDayStartMs.length - 1];
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

        if (!resolvedMint) {
            throw new Error(`Unable to resolve token selector: ${tokenSelector}`);
        }

        const resolvedSymbol = resolvedItem?.symbol || tokenSelector;
        const cachedHistory = await getCachedWalletTokenBalanceHistory(address, resolvedMint);
        const historicalCacheCovered =
            cachedHistory != null &&
            cachedHistory.coveredFromMs <= historicalFromMs &&
            cachedHistory.coveredToMs >= historicalToMs;

        const historicalTokenByTs = new Map<number, BalanceDataPoint>();
        const historicalUsdByTs = new Map<number, BalanceDataPoint>();

        if (historicalCacheCovered) {
            for (const point of cachedHistory.tokenSeries) {
                historicalTokenByTs.set(point.timestamp, point);
            }
            for (const point of cachedHistory.usdSeries) {
                historicalUsdByTs.set(point.timestamp, point);
            }
        }

        const missingDaySec = historicalDayStartMs
            .filter((dayStartMs) => {
                return !historicalTokenByTs.has(dayStartMs) || !historicalUsdByTs.has(dayStartMs);
            })
            .map((dayStartMs) => Math.floor(dayStartMs / 1000));

        if (missingDaySec.length > 0) {
            const dailySnapshots = await mapWithConcurrency(
                missingDaySec,
                TOKEN_BALANCE_SNAPSHOT_CONCURRENCY,
                async (daySec) => {
                    try {
                        const snapshot = await fetchBirdeyePortfolioSnapshot(address, {
                            time: toIsoFromSec(daySec),
                        });
                        return { daySec, snapshot };
                    } catch {
                        return { daySec, snapshot: null };
                    }
                },
            );

            for (const entry of dailySnapshots) {
                const timestamp = entry.daySec * 1000;
                const [tokenPoint, usdPoint] = toSeriesPoints(entry.snapshot, resolvedMint, timestamp);
                historicalTokenByTs.set(timestamp, tokenPoint);
                historicalUsdByTs.set(timestamp, usdPoint);
            }
        }

        const historicalTokenSeries = historicalDayStartMs.map((timestamp) => {
            return historicalTokenByTs.get(timestamp) ?? toZeroPoint(timestamp);
        });
        const historicalUsdSeries = historicalDayStartMs.map((timestamp) => {
            return historicalUsdByTs.get(timestamp) ?? toZeroPoint(timestamp);
        });

        await saveWalletTokenBalanceHistoryCache({
            address,
            tokenAddress: resolvedMint,
            tokenSymbol: resolvedSymbol,
            tokenSeries: historicalTokenSeries,
            usdSeries: historicalUsdSeries,
            coveredFromMs: historicalFromMs,
            coveredToMs: historicalToMs,
        });

        // Fetch live/current snapshot
        let liveSnapshot = null;
        try {
            liveSnapshot = await fetchBirdeyePortfolioSnapshot(address, {
                time: new Date(nowMs).toISOString(),
            });
        } catch {
            liveSnapshot = null;
        }

        const [liveTokenPoint, liveUsdPoint] = toSeriesPoints(liveSnapshot, resolvedMint, nowMs);

        return {
            tokenSeries: [...historicalTokenSeries, liveTokenPoint],
            usdSeries: [...historicalUsdSeries, liveUsdPoint],
            tokenSymbol: resolvedSymbol,
            tokenAddress: resolvedMint,
        };
    } catch (snapshotErr) {
        console.warn("[getWalletTokenBalanceHistory] Snapshot path failed", {
            address,
            tokenSelector,
            error: snapshotErr,
        });
    }

    throw new Error(`Unable to retrieve balance history for token "${tokenSelector}"`);
}

function buildHistoricalDayStartMsList(fromMs: number, toMs: number): number[] {
    const values: number[] = [];
    for (let t = fromMs; t < toMs; t += DAY_MS) {
        values.push(t);
    }
    return values;
}

function toZeroPoint(timestamp: number): BalanceDataPoint {
    return {
        timestamp,
        value: 0,
        date: new Date(timestamp).toISOString(),
    };
}

function toSeriesPoints(
    snapshot: Awaited<ReturnType<typeof fetchBirdeyePortfolioSnapshot>> | null,
    resolvedMint: string,
    timestamp: number,
): [BalanceDataPoint, BalanceDataPoint] {
    if (!snapshot) {
        const zero = toZeroPoint(timestamp);
        return [zero, zero];
    }

    const matchedAsset = snapshot.assets.find((asset) => {
        const assetMint = normalizeMint(asset.tokenAddress);
        if (assetMint && assetMint === resolvedMint) {
            return true;
        }

        return resolvedMint === SOL_MINT && isSolSymbol(asset.symbol);
    });

    if (!matchedAsset) {
        const zero = toZeroPoint(timestamp);
        return [zero, zero];
    }

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

    return [
        {
            timestamp,
            value: Math.max(0, tokenAmount),
            date: new Date(timestamp).toISOString(),
        },
        {
            timestamp,
            value: Math.max(0, usdValue),
            date: new Date(timestamp).toISOString(),
        },
    ];
}
