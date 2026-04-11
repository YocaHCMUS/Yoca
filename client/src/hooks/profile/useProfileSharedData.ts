import { fetchLinkedWalletAddresses } from "@/services/profile/profileDataProvider";
import { useEffect, useState } from "react";


export interface UseProfileSharedDataInput {
    setLoading: (loading: boolean) => void;
}

export interface ProfileSharedDataResult {
    walletAddresses: string[];
    error: boolean;
}

export function useProfileSharedData({ setLoading }: UseProfileSharedDataInput): ProfileSharedDataResult {

    const [walletAddresses, setWalletAddresses] = useState<string[]>([]);
    const [error, setError] = useState(false);

    useEffect(() => {
        setLoading(true);
        try {
            fetchLinkedWalletAddresses()
                .then((addresses) => {
                    setWalletAddresses(addresses);
                })
                ;
        } catch (err) {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    return { walletAddresses, error };
}