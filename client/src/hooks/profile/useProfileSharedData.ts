import {
    fetchLinkedWallets,
    type LinkedWalletRowPayload,
} from "@/services/profile/profileDataProvider";
import { useEffect, useState } from "react";


export interface UseProfileSharedDataInput {
    setLoading: (loading: boolean) => void;
}

export interface ProfileSharedDataResult {
    walletAddresses: string[];
    linkedWallets: LinkedWalletRowPayload[];
    error: boolean;
}

export function useProfileSharedData({ setLoading }: UseProfileSharedDataInput): ProfileSharedDataResult {

    const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
    const [linkedWallets, setLinkedWallets] = useState<LinkedWalletRowPayload[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        const load = async () => {
            setLoading(true);

            try {
                const wallets = await fetchLinkedWallets();
                setLinkedWallets(wallets);
                setWalletAddresses(wallets.map((wallet) => wallet.walletAddress));
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };

        void load();
    }, []);

    return { walletAddresses, linkedWallets, error };
}