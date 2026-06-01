import type { NormalizedSwap } from "../types/normalizedWalletEvent";
import { isSolLikeMint, isStablecoinMint } from "./tokenUtils";
import { average, median, safeDivide, sum } from "./mathUtils";

type PnlLot = {
    token: string;
    remainingAmount: number;
    remainingCostUsd: number;
    boughtAt: string;
};

export function isPositionTokenMint(mint: string): boolean {
    return !isStablecoinMint(mint) && !isSolLikeMint(mint);
}

export function getKnownSwapUsdValue(swap: NormalizedSwap): number | null {
    return swap.estimatedSwapValueUsd ?? swap.inputValueUsd ?? swap.outputValueUsd ?? null;
}

export function isBuyLikeSwapDirection(direction: NormalizedSwap["tradeDirectionForWallet"]): boolean {
    return direction === "BUY" || direction === "STABLE_TO_TOKEN";
}

export function isSellLikeSwapDirection(direction: NormalizedSwap["tradeDirectionForWallet"]): boolean {
    return direction === "SELL" || direction === "TOKEN_TO_STABLE";
}

export function calculateFifoRealizedPnl(swaps: Array<{ swap: NormalizedSwap; timestamp: string }>): {
    realizedPnlUsd: number | null;
    closedPositionCount: number;
    openPositionCount: number;
    winningTradeCount: number;
    losingTradeCount: number;
    winRate: number | null;
    lossRate: number | null;
    averageWinUsd: number | null;
    averageLossUsd: number | null;
    bestTradeUsd: number | null;
    worstTradeUsd: number | null;
    profitFactor: number | null;
} {
    const lotsByToken = new Map<string, PnlLot[]>();
    const closedResults: number[] = [];

    for (const entry of swaps) {
        const { swap, timestamp } = entry;
        const direction = swap.tradeDirectionForWallet;

        if (isBuyLikeSwapDirection(direction)) {
            const token = swap.outputMint;
            const amount = swap.outputAmount;
            const costUsd = swap.estimatedSwapValueUsd ?? swap.inputValueUsd ?? null;

            if (!isPositionTokenMint(token) || amount <= 0 || costUsd == null || costUsd < 0) {
                continue;
            }

            const existingLots = lotsByToken.get(token) ?? [];
            existingLots.push({
                token,
                remainingAmount: amount,
                remainingCostUsd: costUsd,
                boughtAt: timestamp,
            });
            lotsByToken.set(token, existingLots);
            continue;
        }

        if (!isSellLikeSwapDirection(direction)) {
            continue;
        }

        const token = swap.inputMint;
        const amount = swap.inputAmount;
        const proceedsUsd = swap.estimatedSwapValueUsd ?? swap.outputValueUsd ?? null;

        if (!isPositionTokenMint(token) || amount <= 0 || proceedsUsd == null || proceedsUsd < 0) {
            continue;
        }

        const existingLots = lotsByToken.get(token);
        if (existingLots == null || existingLots.length === 0) {
            continue;
        }

        let sellRemaining = amount;
        const proceedsPerToken = proceedsUsd / amount;

        while (sellRemaining > 0 && existingLots.length > 0) {
            const lot = existingLots[0];
            const consumedAmount = Math.min(lot.remainingAmount, sellRemaining);
            if (consumedAmount <= 0) {
                break;
            }

            const costPerToken = safeDivide(lot.remainingCostUsd, lot.remainingAmount, 0) ?? 0;
            const allocatedCost = consumedAmount * costPerToken;
            const allocatedProceeds = consumedAmount * proceedsPerToken;
            closedResults.push(allocatedProceeds - allocatedCost);

            lot.remainingAmount -= consumedAmount;
            lot.remainingCostUsd -= allocatedCost;
            sellRemaining -= consumedAmount;

            if (lot.remainingAmount <= 1e-12) {
                existingLots.shift();
            }
        }

        if (existingLots.length > 0) {
            lotsByToken.set(token, existingLots);
        } else {
            lotsByToken.delete(token);
        }
    }

    const closedPositionCount = closedResults.length;
    const realizedPnlUsd = closedPositionCount > 0 ? sum(closedResults) : null;
    const openPositionCount = [...lotsByToken.values()].reduce(
        (total, lots) => total + lots.filter((lot) => lot.remainingAmount > 1e-12).length,
        0,
    );
    const winningTradeCount = closedResults.filter((pnl) => pnl > 0).length;
    const losingTradeCount = closedResults.filter((pnl) => pnl < 0).length;
    const positivePnls = closedResults.filter((pnl) => pnl > 0);
    const negativePnls = closedResults.filter((pnl) => pnl < 0);
    const grossProfit = sum(positivePnls);
    const grossLoss = Math.abs(sum(negativePnls));

    return {
        realizedPnlUsd,
        closedPositionCount,
        openPositionCount,
        winningTradeCount,
        losingTradeCount,
        winRate: safeDivide(winningTradeCount, closedPositionCount),
        lossRate: safeDivide(losingTradeCount, closedPositionCount),
        averageWinUsd: average(positivePnls),
        averageLossUsd: average(negativePnls),
        bestTradeUsd: closedPositionCount > 0 ? Math.max(...closedResults) : null,
        worstTradeUsd: closedPositionCount > 0 ? Math.min(...closedResults) : null,
        profitFactor: grossLoss > 0 ? grossProfit / grossLoss : null,
    };
}