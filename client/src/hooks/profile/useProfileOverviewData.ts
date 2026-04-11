import { WalletOverview } from "@sv/services/wallet/dtos/walletDataObjects";
import { useEffect, useState } from "react";
import { fetchWalletOverview } from "@/services/wallet/walletApi";

interface UseProfileOverviewDataInput {
    walletAddresses: string[];
}

interface UseProfileOverviewDataResult {
    walletOverviews: WalletOverview[];
    setWalletOverviews: (overviews: WalletOverview[]) => void;
}

export function useProfileOverviewData(
    { walletAddresses }: UseProfileOverviewDataInput,
): UseProfileOverviewDataResult {
    const [walletOverviews, setWalletOverviews] = useState<WalletOverview[]>([]);
    useEffect(() => {
        fetchMultipleWalletOverviews(walletAddresses)
            .then((overviews) => {
                setWalletOverviews(overviews);
            })
            .catch(() => {
                setWalletOverviews([]);
            });
    }, [walletAddresses]);

    return { walletOverviews, setWalletOverviews };
}

async function fetchMultipleWalletOverviews(addresses: string[]): Promise<WalletOverview[]> {
    const overviews = await Promise.all(
        addresses.map((address) => fetchWalletOverview(address))
    );
    return overviews;
}