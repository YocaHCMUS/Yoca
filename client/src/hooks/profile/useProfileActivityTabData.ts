import { fetchWalletOverview, fetchWalletSwaps, fetchWalletTransfers, type WalletOverviewMultiPeriodResponse, type WalletOverviewPeriodKey, type WalletSwapsResponse, type WalletTransfersResponse, type WalletSwap, type WalletTransfer } from "@/services/wallet/walletApi";
import type { TimePeriod } from "@/types/chart-filters.types";
import type { ActivityRow, ProfileActivityData } from "@/types/profile";
import { useEffect, useState } from "react";

interface UseProfileActivityTabDataInput {
    walletAddresses: string[];
    period: TimePeriod;
}

interface UseProfileActivityTabDataResult {
    data: ProfileActivityData;
    loading: boolean;
    error: string | null;
}

const EMPTY_ACTIVITY_DATA: ProfileActivityData = {
    leftNavItems: ["swaps-table", "transfers-table", "wallet-overview-cards", "trade-frequency-heatmap"],
    selectedNav: "swaps-table",
    swapTransferRows: [],
    swapsRaw: [],
    transfersRaw: [],
    walletCards: [],
    heatmap: { cells: [], maxCount: 0 },
};

function normalizePeriod(period: TimePeriod): WalletOverviewPeriodKey {
    if (period === "24H" || period === "7D" || period === "30D" || period === "90D" || period === "All") {
        return period;
    }

    return "30D";
}

function formatAddress(address: string): string {
    if (address.length <= 10) {
        return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatSwapPair(swap: WalletSwap): string {
    const tokensInvolved = typeof swap.tokensInvolved === "string" ? swap.tokensInvolved : String(swap.tokensInvolved ?? "");
    return tokensInvolved.replace(/,/g, " → ");
}

function toAmountUsd(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toActivityRows(walletAddress: string, swaps: WalletSwap[], transfers: WalletTransfer[]): ActivityRow[] {
    const swapRows = swaps.map((swap, index) => ({
        id: `${walletAddress}-swap-${index}-${swap.transactionHash}`,
        walletId: walletAddress,
        walletLabel: formatAddress(walletAddress),
        type: "swap" as const,
        pairOrToken: formatSwapPair(swap),
        amountUsd: toAmountUsd(swap.totalValueUsd),
        timestamp: swap.blockTimestampIso,
        exchange: swap.exchangeName || "Unknown",
        soldToken: swap.sold?.symbol || swap.sold?.name || "Unknown",
        boughtToken: swap.bought?.symbol || swap.bought?.name || "Unknown",
        baseQuotePrice: toAmountUsd(swap.baseQuotePrice),
        txHash: swap.transactionHash,
    }));

    const transferRows = transfers.map((transfer, index) => ({
        id: `${walletAddress}-transfer-${index}-${transfer.transactionSignature}`,
        walletId: walletAddress,
        walletLabel: formatAddress(walletAddress),
        type: "transfer" as const,
        pairOrToken: transfer.tokenSymbol || transfer.tokenName || "Unknown",
        amountUsd: toAmountUsd(transfer.amountUsd ?? 0),
        timestamp: transfer.timestamp,
        fromAddress: transfer.from,
        toAddress: transfer.to,
        amount: transfer.amount,
        tokenSymbol: transfer.tokenSymbol || transfer.tokenName || "Unknown",
        signature: transfer.transactionSignature,
    }));

    return [...swapRows, ...transferRows].sort((left, right) => right.timestamp.localeCompare(left.timestamp));
}

export function useProfileActivityTabData({ walletAddresses, period }: UseProfileActivityTabDataInput): UseProfileActivityTabDataResult {
    const [data, setData] = useState<ProfileActivityData>(EMPTY_ACTIVITY_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const load = async () => {
            if (walletAddresses.length === 0) {
                setData(EMPTY_ACTIVITY_DATA);
                setLoading(false);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const periodKey = normalizePeriod(period);
                const results = await Promise.allSettled(
                    walletAddresses.map(async (walletAddress) => {
                        const [overview, swapsResult, transfersResult] = await Promise.all([
                            fetchWalletOverview(walletAddress),
                            fetchWalletSwaps(walletAddress),
                            fetchWalletTransfers(walletAddress),
                        ]);

                        return { walletAddress, overview, swapsResult, transfersResult };
                    }),
                );

                if (!isActive) {
                    return;
                }

                const swapTransferRows: ActivityRow[] = [];
                const swapsRaw: WalletSwap[] = [];
                const transfersRaw: WalletTransfer[] = [];
                const walletCards = results
                    .filter((result): result is PromiseFulfilledResult<{
                        walletAddress: string;
                        overview: WalletOverviewMultiPeriodResponse;
                        swapsResult: WalletSwapsResponse;
                        transfersResult: WalletTransfersResponse;
                    }> => result.status === "fulfilled")
                    .map((result) => {
                        const { walletAddress, overview, swapsResult, transfersResult } = result.value;
                        swapsRaw.push(...(swapsResult.swaps ?? []));
                        transfersRaw.push(...(transfersResult.transfers ?? []));
                        swapTransferRows.push(
                            ...toActivityRows(walletAddress, swapsResult.swaps ?? [], transfersResult.transfers ?? []),
                        );

                        const stats = overview.periods[periodKey] ?? overview.periods[overview.selectedPeriod];
                        const totalAssetValueUsd = overview.totalAssetValueUsd ?? overview.holdings.totalAssetValueUsd ?? 0;

                        return {
                            walletId: walletAddress,
                            walletLabel: formatAddress(walletAddress),
                            walletAddress,
                            totalAssetValueUsd,
                            unrealizedPnlInPeriodUsd: stats?.pnl?.unrealizedUsd ?? 0,
                            tradingVolumeUsd: stats?.tradingVolumeUsd ?? 0,
                            buyTradingVolumeUsd: stats?.buy.volumeUsd ?? 0,
                            sellTradingVolumeUsd: stats?.sell.volumeUsd ?? 0,
                            buyTransactionCount: stats?.buy.transactionCount ?? 0,
                            sellTransactionCount: stats?.sell.transactionCount ?? 0,
                            tokenAmountTraded: stats?.tokensTradedCount ?? 0,
                            tokenAmountHolding: overview.tokensHoldingCount ?? overview.holdings.tokensHoldingCount ?? 0,
                            totalPnlUsd: stats?.pnl?.totalUsd ?? 0,
                            realizedPnlUsd: stats?.pnl?.realizedUsd ?? 0,
                            unrealizedPnlUsd: stats?.pnl?.unrealizedUsd ?? 0,
                        };
                    });

                swapTransferRows.sort((left, right) => right.timestamp.localeCompare(left.timestamp));

                setData({
                    leftNavItems: ["swaps-table", "transfers-table", "wallet-overview-cards", "trade-frequency-heatmap"],
                    selectedNav: "swaps-table",
                    swapTransferRows,
                    swapsRaw,
                    transfersRaw,
                    walletCards,
                    heatmap: { cells: [], maxCount: 0 },
                });
            } catch (loadError) {
                if (!isActive) {
                    return;
                }

                setData(EMPTY_ACTIVITY_DATA);
                setError(loadError instanceof Error ? loadError.message : "Failed to load activity data");
            } finally {
                if (isActive) {
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            isActive = false;
        };
    }, [period, walletAddresses]);

    return { data, loading, error };
}