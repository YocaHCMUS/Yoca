import client from "@/api/main";
import type { ApiErrCode } from "@/api/main";

export type AuthProvider = "password" | "google" | "github" | "solana" | "other";

export interface ProfileSettingsSnapshot {
    userId: string;
    displayName: string | null;
    email: string | null;
    authMethods: AuthProvider[];
    hasPassword: boolean;
    linkedWallets: Array<{
        walletAddress: string;
        isAuthWallet: boolean;
    }>;
}

export interface UpdateProfileIdentityInput {
    displayName?: string | null;
    email?: string | null;
}

export interface UpdatePasswordInput {
    currentPassword?: string;
    newPassword: string;
    email?: string | null;
}

export type PasswordUpdateSuccessState = "PASSWORD_CHANGED" | "PASSWORD_ADDED";

export class PasswordUpdateError extends Error {
    state: ApiErrCode;

    constructor(state: ApiErrCode) {
        super(state);
        this.state = state;
    }
}

export interface DeleteAccountInput {
    challengeToken: string;
    confirmText: "DELETE MY ACCOUNT";
}

interface TokenWatchlistResponse {
    userId: string;
    rows: Array<{
        tokenAddress?: string;
        tokenId?: string;
    }>;
}

interface WalletWatchlistResponse {
    userId: string;
    rows: Array<{
        walletAddress?: string;
        address?: string;
    }>;
}

export async function getProfileSettingsSnapshot(): Promise<ProfileSettingsSnapshot> {
    const resp = await client.api.profile.settings.$get();

    if (!resp.ok) {
        throw new Error(`Failed to fetch profile settings: ${resp.status}`);
    }

    return resp.json();
}

export async function updateProfileIdentity(input: UpdateProfileIdentityInput): Promise<ProfileSettingsSnapshot> {
    const resp = await client.api.profile.settings.identity.$patch({ json: input });

    if (!resp.ok) {
        throw new Error(`Failed to update profile identity: ${resp.status}`);
    }

    return resp.json();
}

export async function updatePassword(input: UpdatePasswordInput): Promise<{ state: PasswordUpdateSuccessState }> {
    const resp = await client.api.profile.settings.password.$patch({ json: input });

    const body = await resp.json().catch(() => null) as
        | { state?: PasswordUpdateSuccessState; errorCode?: ApiErrCode }
        | null;

    if (!resp.ok) {
        throw new PasswordUpdateError(body?.errorCode ?? "INTERNAL_SERVER_ERR");
    }

    return {
        state: body?.state ?? "PASSWORD_CHANGED",
    };
}

export async function createDeleteAccountChallenge(): Promise<{ challengeToken: string }> {
    const resp = await client.api.profile.settings.account.challenge.$post();

    if (!resp.ok) {
        throw new Error(`Failed to create account deletion challenge: ${resp.status}`);
    }

    return resp.json();
}

export async function deleteAccount(input: DeleteAccountInput) {
    const resp = await client.api.profile.settings.account.$delete({ json: input });

    if (!resp.ok) {
        throw new Error(`Failed to delete account: ${resp.status}`);
    }

    return resp.json();
}

export async function getAuthMethods(): Promise<AuthProvider[]> {
    const resp = await client.api.profile.settings["auth-methods"].$get();

    if (!resp.ok) {
        throw new Error(`Failed to fetch auth methods: ${resp.status}`);
    }

    const body = await resp.json() as { authMethods: AuthProvider[] };
    return body.authMethods;
}

export async function getTokenWatchlist(): Promise<string[]> {
    const resp = await client.api.profile.watchlist.tokens.$get();

    if (!resp.ok) {
        throw new Error(`Failed to fetch token watchlist: ${resp.status}`);
    }

    const body = await resp.json() as TokenWatchlistResponse;
    return body.rows
        .map((row) => row.tokenAddress ?? row.tokenId)
        .filter((address): address is string => Boolean(address));
}

export async function getWalletWatchlist(): Promise<string[]> {
    const resp = await client.api.profile.watchlist.addresses.$get();

    if (!resp.ok) {
        throw new Error(`Failed to fetch wallet watchlist: ${resp.status}`);
    }

    const body = await resp.json() as WalletWatchlistResponse;
    return body.rows
        .map((row) => row.walletAddress ?? row.address)
        .filter((address): address is string => Boolean(address));
}

export async function addTokenToWatchlist(tokenAddress: string) {
    const resp = await client.api.profile.watchlist["tokens-update"].$post({
        json: { tokenAddress },
    });

    if (!resp.ok) {
        throw new Error(`Failed to add token to watchlist: ${resp.status}`);
    }

    return resp.json();
}

export async function removeTokenFromWatchlist(tokenAddress: string) {
    const resp = await client.api.profile.watchlist["tokens-update"].$delete({
        json: { tokenAddress },
    });

    if (!resp.ok) {
        throw new Error(`Failed to remove token from watchlist: ${resp.status}`);
    }

    return resp.json();
}

export async function addWalletToWatchlist(walletAddress: string) {
    const resp = await client.api.profile.watchlist["addresses-update"].$post({
        json: { walletAddress },
    });

    if (!resp.ok) {
        throw new Error(`Failed to add wallet to watchlist: ${resp.status}`);
    }

    return resp.json();
}

export async function removeWalletFromWatchlist(walletAddress: string) {
    const resp = await client.api.profile.watchlist["addresses-update"].$delete({
        json: { walletAddress },
    });

    if (!resp.ok) {
        throw new Error(`Failed to remove wallet from watchlist: ${resp.status}`);
    }

    return resp.json();
}


export async function fetchLinkedWalletAddresses() {
    return client.api.profile["linked-wallets"].$get().then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        } else {
            throw new Error(`Failed to fetch linked wallets: ${resp.status}`);
        }
    });
}

export async function requestLinkWalletChallenge(walletAddress: string) {
    return client.api.profile["linked-wallets"].challenge.$post({ json: { walletAddress } }).then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        } else {
            throw new Error(`Failed to request wallet link challenge: ${resp.status}`);
        }
    });
}

export async function linkWalletAddress(walletAddress: string, nonce: string, signature: string) {
    return client.api.profile["linked-wallets"].$post({ json: { walletAddress, nonce, signature } }).then((resp) => {
        if (resp.status === 201) {
            return resp.json();
        } else {
            throw new Error(`Failed to link wallet: ${resp.status}`);
        }
    });
}

export async function unlinkWalletAddress(walletAddress: string) {
    return client.api.profile["linked-wallets"].$delete({ json: { walletAddress } }).then((resp) => {
        if (resp.status === 200) {
            return resp.json();
        } else {
            throw new Error(`Failed to unlink wallet: ${resp.status}`);
        }
    });
}