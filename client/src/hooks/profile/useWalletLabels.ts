import useSWR from "swr";
import { getWalletLabels, setWalletLabel as apiSetWalletLabel } from "@/services/profile/profileApi";
import { useAuth } from "@/contexts/AuthContext";

export function useWalletLabels() {
    const { user } = useAuth();
    
    const { data, error, isLoading, mutate } = useSWR<Record<string, string>>(
        user?.userId ? `walletLabels-${user.userId}` : null,
        getWalletLabels,
        {
            revalidateOnFocus: false,
        }
    );

    const setLabel = async (walletAddress: string, label: string) => {
        const trimmed = label.trim();
        
        // Optimistic update
        mutate(
            (currentLabels: Record<string, string> | undefined) => {
                const next = { ...(currentLabels ?? {}) };
                if (!trimmed) {
                    delete next[walletAddress];
                } else {
                    next[walletAddress] = trimmed;
                }
                return next;
            },
            false // don't revalidate immediately
        );

        try {
            await apiSetWalletLabel(walletAddress, trimmed);
            // Revalidate after success
            mutate();
        } catch (err) {
            // Revert on error
            mutate();
            throw err;
        }
    };

    const getLabel = (walletAddress: string): string | null => {
        return data?.[walletAddress] ?? null;
    };

    return {
        labels: data ?? ({} as Record<string, string>),
        isLoading,
        error,
        getLabel,
        setLabel,
    };
}
