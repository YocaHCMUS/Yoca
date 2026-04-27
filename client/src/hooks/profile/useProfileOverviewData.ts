import { WalletOverview } from "@sv/services/wallet/dtos/walletDataObjects";
import { useEffect, useState } from "react";
import { fetchWalletOverview } from "@/services/wallet/walletApi";

interface UseProfileOverviewDataInput {
    walletAddresses: string[];
}

interface UseProfileOverviewDataResult {
    walletOverviews: WalletOverview[];
    setWalletOverviews: (overviews: WalletOverview[]) => void;
    loading: boolean;
    error: string | null;
}

export function useProfileOverviewData(
    { walletAddresses }: UseProfileOverviewDataInput,
): UseProfileOverviewDataResult {
    const [walletOverviews, setWalletOverviews] = useState<WalletOverview[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isActive = true;

        if (walletAddresses.length === 0) {
            setWalletOverviews([]);
            setLoading(false);
            setError(null);
            return;
        }

        setLoading(true);
        setError(null);

        fetchMultipleWalletOverviews(walletAddresses)
            .then((overviews) => {
                if (!isActive) {
                    return;
                }
                setWalletOverviews(overviews);
            })
            .catch((loadError) => {
                if (!isActive) {
                    return;
                }
                setWalletOverviews([]);
                setError(loadError instanceof Error ? loadError.message : "Failed to load profile overview");
            })
            .finally(() => {
                if (!isActive) {
                    return;
                }

                setLoading(false);
            });

        return () => {
            isActive = false;
        };
    }, [walletAddresses]);

    return { walletOverviews, setWalletOverviews, loading, error };
}

async function fetchMultipleWalletOverviews(addresses: string[]): Promise<WalletOverview[]> {
    const overviews = await Promise.all(
        addresses.map((address) => fetchWalletOverview(address))
    );
    return overviews;
}