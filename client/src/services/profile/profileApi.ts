import client from "@/api/main";

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

export interface DeleteAccountInput {
    challengeToken: string;
    confirmText: "DELETE MY ACCOUNT";
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

export async function updatePassword(input: UpdatePasswordInput) {
    const resp = await client.api.profile.settings.password.$patch({ json: input });

    if (!resp.ok) {
        throw new Error(`Failed to update password: ${resp.status}`);
    }

    return resp.json();
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