import { fetchWalletOverview, type WalletOverviewMultiPeriodResponse, type WalletOverviewPeriodKey } from "@/services/wallet/walletApi";
import type { TimePeriod } from "@/types/chart-filters.types";
import type { LinkedWalletRow, ProfileWalletsData } from "@/types/profile";
import { useEffect, useState } from "react";

interface UseProfileWalletTabDataInput {
    walletAddresses: string[];
    period: TimePeriod;
}

interface UseProfileWalletTabDataResult {
    data: ProfileWalletsData;
    loading: boolean;
    error: string | null;
}

const EMPTY_WALLET_DATA: ProfileWalletsData = {
    leftNavItems: ["portfolio-table", "linked-wallets", "balance-chart", "drawdown-chart"],
    selectedNav: "portfolio-table",
    portfolioRows: [],
    linkedWalletRows: [],
    selectedComparisonWalletIds: [],
    walletDetailRouteTemplate: "/wallets/:walletId",
    comparisonTargetRoute: "/comparison/wallets",
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

export function useProfileWalletTabData({ walletAddresses, period }: UseProfileWalletTabDataInput): UseProfileWalletTabDataResult {
    const [data, setData] = useState<ProfileWalletsData>(EMPTY_WALLET_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        const load = async () => {
            if (walletAddresses.length === 0) {
                setData(EMPTY_WALLET_DATA);
                setLoading(false);
                setError(null);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const results = await Promise.allSettled(
                    walletAddresses.map((address) => fetchWalletOverview(address)),
                );

                if (!isActive) {
                    return;
                }

                const overviews = results
                    .filter((result): result is PromiseFulfilledResult<WalletOverviewMultiPeriodResponse> => result.status === "fulfilled")
                    .map((result) => result.value);
                const periodKey = normalizePeriod(period);

                const portfolioRows = overviews.map((overview) => {
                    const stats = overview.periods[periodKey] ?? overview.periods[overview.selectedPeriod];
                    const totalAssetValueUsd = overview.totalAssetValueUsd ?? overview.holdings.totalAssetValueUsd ?? 0;
                    const pnlUsd = stats?.pnl?.totalUsd ?? overview.pnlUsdTotal ?? 0;

                    return {
                        walletId: overview.address,
                        walletLabel: formatAddress(overview.address),
                        netWorthUsd: totalAssetValueUsd,
                        pnlUsd,
                        pnlPct: totalAssetValueUsd > 0 ? (pnlUsd / totalAssetValueUsd) * 100 : 0,
                        tradeCount: stats?.transactionCount ?? overview.transactionCount24h ?? 0,
                    };
                });

                const linkedWalletRows: LinkedWalletRow[] = overviews.map((overview) => {
                    const stats = overview.periods[periodKey] ?? overview.periods[overview.selectedPeriod];
                    const totalAssetValueUsd = overview.totalAssetValueUsd ?? overview.holdings.totalAssetValueUsd ?? 0;
                    const hasRecentActivity = (stats?.transactionCount ?? 0) > 0 || totalAssetValueUsd > 0;

                    return {
                        walletId: overview.address,
                        walletAddress: overview.address,
                        walletLabel: formatAddress(overview.address),
                        netWorthUsd: totalAssetValueUsd,
                        lastActiveAt: new Date().toISOString(),
                        status: hasRecentActivity ? "connected" : "inactive",
                    };
                });

                setData({
                    leftNavItems: ["portfolio-table", "linked-wallets", "balance-chart", "drawdown-chart"],
                    selectedNav: "portfolio-table",
                    portfolioRows,
                    linkedWalletRows,
                    selectedComparisonWalletIds: linkedWalletRows.slice(0, 2).map((row) => row.walletId),
                    walletDetailRouteTemplate: "/wallets/:walletId",
                    comparisonTargetRoute: "/comparison/wallets",
                });
            } catch (loadError) {
                if (!isActive) {
                    return;
                }

                setData(EMPTY_WALLET_DATA);
                setError(loadError instanceof Error ? loadError.message : "Failed to load wallet data");
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