import { useAuth } from "@/contexts/AuthContext";
import {
    addTokenToWatchlist,
    addWalletToWatchlist,
    getTokenWatchlist,
    getWalletWatchlist,
    removeTokenFromWatchlist,
    removeWalletFromWatchlist,
} from "@/services/profile/profileApi";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

interface WatchlistContextType {
    tokenWatchlist: string[];
    walletWatchlist: string[];
    isLoading: boolean;
    tokenPending: Record<string, boolean>;
    walletPending: Record<string, boolean>;
    refetch: () => Promise<void>;
    addToken: (tokenAddress: string) => Promise<void>;
    removeToken: (tokenAddress: string) => Promise<void>;
    toggleToken: (tokenAddress: string) => Promise<void>;
    addWallet: (walletAddress: string) => Promise<void>;
    removeWallet: (walletAddress: string) => Promise<void>;
    toggleWallet: (walletAddress: string) => Promise<void>;
}

const WatchlistContext = createContext<WatchlistContextType | undefined>(
    undefined,
);

function pushUnique(items: string[], value: string): string[] {
    if (items.includes(value)) return items;
    return [...items, value];
}

function removeValue(items: string[], value: string): string[] {
    return items.filter((item) => item !== value);
}

export function WatchlistProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [tokenWatchlist, setTokenWatchlist] = useState<string[]>([]);
    const [walletWatchlist, setWalletWatchlist] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [tokenPending, setTokenPending] = useState<Record<string, boolean>>({});
    const [walletPending, setWalletPending] = useState<Record<string, boolean>>({});

    const refetch = useCallback(async () => {
        if (!user) {
            setTokenWatchlist([]);
            setWalletWatchlist([]);
            return;
        }

        setIsLoading(true);
        try {
            const [tokens, wallets] = await Promise.all([
                getTokenWatchlist(),
                getWalletWatchlist(),
            ]);
            setTokenWatchlist(tokens);
            setWalletWatchlist(wallets);
        } catch {
            setTokenWatchlist([]);
            setWalletWatchlist([]);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        void refetch();
    }, [refetch]);

    const addToken = useCallback(async (tokenAddress: string) => {
        setTokenPending((prev) => ({ ...prev, [tokenAddress]: true }));
        setTokenWatchlist((prev) => pushUnique(prev, tokenAddress));

        try {
            await addTokenToWatchlist(tokenAddress);
        } catch (error) {
            setTokenWatchlist((prev) => removeValue(prev, tokenAddress));
            throw error;
        } finally {
            setTokenPending((prev) => ({ ...prev, [tokenAddress]: false }));
        }
    }, []);

    const removeToken = useCallback(async (tokenAddress: string) => {
        setTokenPending((prev) => ({ ...prev, [tokenAddress]: true }));
        setTokenWatchlist((prev) => removeValue(prev, tokenAddress));

        try {
            await removeTokenFromWatchlist(tokenAddress);
        } catch (error) {
            setTokenWatchlist((prev) => pushUnique(prev, tokenAddress));
            throw error;
        } finally {
            setTokenPending((prev) => ({ ...prev, [tokenAddress]: false }));
        }
    }, []);

    const toggleToken = useCallback(
        async (tokenAddress: string) => {
            const exists = tokenWatchlist.includes(tokenAddress);
            if (exists) {
                await removeToken(tokenAddress);
                return;
            }
            await addToken(tokenAddress);
        },
        [addToken, removeToken, tokenWatchlist],
    );

    const addWallet = useCallback(async (walletAddress: string) => {
        setWalletPending((prev) => ({ ...prev, [walletAddress]: true }));
        setWalletWatchlist((prev) => pushUnique(prev, walletAddress));

        try {
            await addWalletToWatchlist(walletAddress);
        } catch (error) {
            setWalletWatchlist((prev) => removeValue(prev, walletAddress));
            throw error;
        } finally {
            setWalletPending((prev) => ({ ...prev, [walletAddress]: false }));
        }
    }, []);

    const removeWallet = useCallback(async (walletAddress: string) => {
        setWalletPending((prev) => ({ ...prev, [walletAddress]: true }));
        setWalletWatchlist((prev) => removeValue(prev, walletAddress));

        try {
            await removeWalletFromWatchlist(walletAddress);
        } catch (error) {
            setWalletWatchlist((prev) => pushUnique(prev, walletAddress));
            throw error;
        } finally {
            setWalletPending((prev) => ({ ...prev, [walletAddress]: false }));
        }
    }, []);

    const toggleWallet = useCallback(
        async (walletAddress: string) => {
            const exists = walletWatchlist.includes(walletAddress);
            if (exists) {
                await removeWallet(walletAddress);
                return;
            }
            await addWallet(walletAddress);
        },
        [addWallet, removeWallet, walletWatchlist],
    );

    const value = useMemo<WatchlistContextType>(
        () => ({
            tokenWatchlist,
            walletWatchlist,
            isLoading,
            tokenPending,
            walletPending,
            refetch,
            addToken,
            removeToken,
            toggleToken,
            addWallet,
            removeWallet,
            toggleWallet,
        }),
        [
            tokenWatchlist,
            walletWatchlist,
            isLoading,
            tokenPending,
            walletPending,
            refetch,
            addToken,
            removeToken,
            toggleToken,
            addWallet,
            removeWallet,
            toggleWallet,
        ],
    );

    return (
        <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>
    );
}

export function useWatchlist() {
    const context = useContext(WatchlistContext);

    if (context == undefined) {
        throw new Error("useWatchlist must be used within a WatchlistProvider");
    }

    return context;
}
