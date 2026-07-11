import type { NormalizedWalletEvent } from "../types/normalizedWalletEvent";
import type { PnlProfile } from "../types/walletBehaviorProfile";
import { calculateFifoRealizedPnl, isBuyLikeSwapDirection, isSellLikeSwapDirection } from "../utils/pnlUtils";
import { sortEventsByTimestampAsc } from "../utils/timeUtils";

export function analyzePnl(events: NormalizedWalletEvent[]): PnlProfile {
    const sortedEvents = sortEventsByTimestampAsc(events);
    const swapEvents = sortedEvents
        .filter((event) => event.type === "SWAP" && event.swap != null)
        .map((event) => ({
            event,
            swap: event.swap!,
        }));

    const fifoResult = calculateFifoRealizedPnl(
        swapEvents
            .filter(({ swap }) => isBuyLikeSwapDirection(swap.tradeDirectionForWallet) || isSellLikeSwapDirection(swap.tradeDirectionForWallet))
            .map(({ event, swap }) => ({
                timestamp: event.timestamp,
                swap,
            })),
    );

    const calculableClosedResults = fifoResult.closedPositionCount > 0 ? fifoResult.realizedPnlUsd : null;
    const realizedPnlUsd = calculableClosedResults;
    const totalPnlUsd = realizedPnlUsd;

    return {
        realizedPnlUsd,
        unrealizedPnlUsd: null,
        totalPnlUsd,
        closedPositionCount: fifoResult.closedPositionCount,
        openPositionCount: fifoResult.openPositionCount,
        winningTradeCount: fifoResult.winningTradeCount,
        losingTradeCount: fifoResult.losingTradeCount,
        winRate: fifoResult.winRate,
        lossRate: fifoResult.lossRate,
        averageWinUsd: fifoResult.averageWinUsd,
        averageLossUsd: fifoResult.averageLossUsd,
        bestTradeUsd: fifoResult.bestTradeUsd,
        worstTradeUsd: fifoResult.worstTradeUsd,
        profitFactor: fifoResult.profitFactor,
        pnlStatus:
            realizedPnlUsd == null
                ? "UNKNOWN"
                : realizedPnlUsd > 0
                    ? "PROFITABLE"
                    : realizedPnlUsd < 0
                        ? "UNPROFITABLE"
                        : "BREAKEVEN",
        calculationMethod: "FIFO",
        limitations: [
            "PnL is calculated only from swap events with available USD values.",
            "Transfers, airdrops, staking rewards, and unknown cost basis assets are excluded.",
            "Unrealized PnL is not included unless current token prices are provided.",
        ],
    };
}