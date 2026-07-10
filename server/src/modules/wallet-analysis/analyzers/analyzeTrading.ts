import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { TradingBehaviorProfile, WalletActivityProfile } from "../types/walletBehaviorProfile";
import { average, median, sum } from "../utils/mathUtils";
import { diffHours, sortEventsByTimestampAsc } from "../utils/timeUtils";
import { isPositionTokenMint, isSellLikeSwapDirection, isBuyLikeSwapDirection } from "../utils/pnlUtils";
import { isStablecoinMint } from "../utils/tokenUtils";

type TokenLot = {
    amount: number;
    boughtAt: string;
};

export function analyzeTrading(
    events: NormalizedWalletEvent[],
    activity?: WalletActivityProfile,
): TradingBehaviorProfile {
    const sortedEvents = sortEventsByTimestampAsc(events);
    const swapEvents = sortedEvents.filter((event) => event.type === "SWAP" && event.swap != null);

    const swapCount = swapEvents.length;
    const buyCount = swapEvents.filter((event) => isBuyLikeSwapDirection(event.swap!.tradeDirectionForWallet)).length;
    const sellCount = swapEvents.filter((event) => isSellLikeSwapDirection(event.swap!.tradeDirectionForWallet)).length;

    const knownTradeValues = swapEvents
        .map((event) => event.swap!.estimatedSwapValueUsd ?? event.swap!.inputValueUsd ?? event.swap!.outputValueUsd ?? null)
        .filter((value): value is number => value != null);

    const uniqueTokensTraded = new Set<string>();
    const uniqueTokensBought = new Set<string>();
    const uniqueTokensSold = new Set<string>();
    let stablecoinSwapCount = 0;

    const lotsByToken = new Map<string, TokenLot[]>();
    const holdingPeriodsHours: number[] = [];

    for (const event of swapEvents) {
        const swap = event.swap!;

        if (isStablecoinMint(swap.inputMint) || isStablecoinMint(swap.outputMint)) {
            stablecoinSwapCount += 1;
        }

        if (isPositionTokenMint(swap.inputMint)) {
            uniqueTokensTraded.add(swap.inputMint);
        }
        if (isPositionTokenMint(swap.outputMint)) {
            uniqueTokensTraded.add(swap.outputMint);
        }

        if (isBuyLikeSwapDirection(swap.tradeDirectionForWallet)) {
            if (isPositionTokenMint(swap.outputMint)) {
                uniqueTokensBought.add(swap.outputMint);
            }

            if (!isPositionTokenMint(swap.outputMint)) {
                continue;
            }

            const existingLots = lotsByToken.get(swap.outputMint) ?? [];
            existingLots.push({ amount: swap.outputAmount, boughtAt: event.timestamp });
            lotsByToken.set(swap.outputMint, existingLots);
            continue;
        }

        if (!isSellLikeSwapDirection(swap.tradeDirectionForWallet) || !isPositionTokenMint(swap.inputMint)) {
            continue;
        }

        uniqueTokensSold.add(swap.inputMint);
        const existingLots = lotsByToken.get(swap.inputMint);
        if (existingLots == null || existingLots.length === 0) {
            continue;
        }

        let sellRemaining = swap.inputAmount;
        while (sellRemaining > 0 && existingLots.length > 0) {
            const lot = existingLots[0];
            const consumedAmount = Math.min(lot.amount, sellRemaining);
            if (consumedAmount <= 0) {
                break;
            }

            holdingPeriodsHours.push(diffHours(lot.boughtAt, event.timestamp));
            lot.amount -= consumedAmount;
            sellRemaining -= consumedAmount;

            if (lot.amount <= 1e-12) {
                existingLots.shift();
            }
        }

        if (existingLots.length > 0) {
            lotsByToken.set(swap.inputMint, existingLots);
        } else {
            lotsByToken.delete(swap.inputMint);
        }
    }

    const totalVolumeUsd = knownTradeValues.length > 0 ? sum(knownTradeValues) : null;
    const stablecoinUsageRatio = swapCount > 0 ? stablecoinSwapCount / swapCount : null;
    const averageHoldingPeriodHours = average(holdingPeriodsHours);
    const medianHoldingPeriodHours = median(holdingPeriodsHours);
    const shortTermTradeRatio = holdingPeriodsHours.length > 0 ? holdingPeriodsHours.filter((hours) => hours <= 24).length / holdingPeriodsHours.length : null;
    const longTermHoldRatio = holdingPeriodsHours.length > 0 ? holdingPeriodsHours.filter((hours) => hours >= 720).length / holdingPeriodsHours.length : null;

    let tradingStyle: TradingBehaviorProfile["tradingStyle"] = "UNKNOWN";
    if (swapCount === 0) {
        tradingStyle = "UNKNOWN";
    } else if (shortTermTradeRatio != null && medianHoldingPeriodHours != null && shortTermTradeRatio >= 0.7 && medianHoldingPeriodHours <= 1) {
        tradingStyle = "SNIPER";
    } else if (swapCount >= 100 || (activity?.maxTransactionsInOneHour ?? 0) >= 30) {
        tradingStyle = "HIGH_FREQUENCY_TRADER";
    } else if (swapCount >= 20) {
        tradingStyle = "ACTIVE_TRADER";
    } else if (longTermHoldRatio != null && swapCount <= 3 && longTermHoldRatio >= 0.6) {
        tradingStyle = "HOLDER";
    } else if (swapCount > 0 && swapCount < 20) {
        tradingStyle = "CASUAL_TRADER";
    }

    return {
        swapCount,
        buyCount,
        sellCount,
        uniqueTokensTraded: uniqueTokensTraded.size,
        uniqueTokensBought: uniqueTokensBought.size,
        uniqueTokensSold: uniqueTokensSold.size,
        totalVolumeUsd,
        averageTradeSizeUsd: average(knownTradeValues),
        medianTradeSizeUsd: median(knownTradeValues),
        largestTradeUsd: knownTradeValues.length > 0 ? Math.max(...knownTradeValues) : null,
        stablecoinUsageRatio,
        averageHoldingPeriodHours,
        medianHoldingPeriodHours,
        shortTermTradeRatio,
        longTermHoldRatio,
        tradingStyle,
    };
}