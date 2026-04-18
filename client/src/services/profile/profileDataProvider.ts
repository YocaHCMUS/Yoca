import client from "@/api/main";
import type { ProfilePageData } from "@/types/profile";
import type { TimePeriod } from "@/types/chart-filters.types";
import { adaptProfilePayload } from "@/services/profile/profileAdapters";
import { profileMockApiPayload } from "@/services/profile/profileMockData";

export type ProfileDataSource = "mock" | "api";

export interface ProfileDataProvider {
    getProfilePageData(params: {
        period: TimePeriod;
    }): Promise<ProfilePageData>;
}

interface LinkedWalletsResponse {
    userId: string;
    rows: Array<{
        walletAddress: string;
        isAuthWallet: boolean;
    }>;
}

export interface LinkedWalletRowPayload {
    walletAddress: string;
    isAuthWallet: boolean;
}

function formatAddress(address: string): string {
    if (address.length <= 10) {
        return address;
    }

    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export async function fetchLinkedWalletAddresses(): Promise<string[]> {
    const linkedWallets = await fetchLinkedWallets();
    return linkedWallets.map((row) => row.walletAddress);
}

export async function fetchLinkedWallets(): Promise<LinkedWalletRowPayload[]> {
    const response = await client.api.profile["linked-wallets"].$get();

    if (!response.ok) {
        throw new Error(`Failed to fetch linked wallets: ${response.status}`);
    }

    const payload = (await response.json()) as LinkedWalletsResponse;
    return payload.rows;
}

export async function linkNewWallet(walletAddress: string) {
    const challengeResponse = await client.api.profile["linked-wallets"].challenge.$post({
        json: {
            walletAddress,
        },
    });

    if (!challengeResponse.ok) {
        throw new Error(`Failed to request wallet link challenge: ${challengeResponse.status}`);
    }

    return challengeResponse.json();
}

export async function unlinkWallet(walletAddress: string) {
    const response = await client.api.profile["linked-wallets"].$delete({
        json: {
            walletAddress,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to unlink wallet: ${response.status}`);
    }

    return response.json();
}




class MockProfileDataProvider implements ProfileDataProvider {
    async getProfilePageData(params: {
        period: TimePeriod;
    }): Promise<ProfilePageData> {
        const adapted = adaptProfilePayload(profileMockApiPayload);

        return {
            ...adapted,
            overview: {
                ...adapted.overview,
                period: params.period,
            },
        };
    }
}

class ApiProfileDataProvider implements ProfileDataProvider {
    async getProfilePageData(params: {
        period: TimePeriod;
    }): Promise<ProfilePageData> {
        const adapted = adaptProfilePayload(profileMockApiPayload);
        const linkedWalletAddresses = await fetchLinkedWalletAddresses();
        const linkedWalletRows = linkedWalletAddresses.map((walletAddress, index) => ({
            walletId: walletAddress,
            walletAddress,
            walletLabel:
                adapted.wallets.linkedWalletRows[index]?.walletLabel ?? formatAddress(walletAddress),
            netWorthUsd: adapted.wallets.linkedWalletRows[index]?.netWorthUsd ?? 0,
            lastActiveAt:
                adapted.wallets.linkedWalletRows[index]?.lastActiveAt ?? new Date().toISOString(),
            status: adapted.wallets.linkedWalletRows[index]?.status ?? "inactive",
        }));

        return {
            ...adapted,
            overview: {
                ...adapted.overview,
                period: params.period,
                linkedWalletCount: linkedWalletRows.length,
            },
            wallets: {
                ...adapted.wallets,
                linkedWalletRows,
                selectedComparisonWalletIds: linkedWalletRows.slice(0, 2).map((row) => row.walletId),
            },
        };
    }
}

export function getProfileDataSource(): ProfileDataSource {
    const value = (import.meta.env.VITE_PROFILE_DATA_SOURCE ?? "mock")
        .toString()
        .toLowerCase();

    return value === "api" ? "api" : "mock";
}

export function getProfileDataProvider(): ProfileDataProvider {
    const source = getProfileDataSource();
    return source === "api"
        ? new ApiProfileDataProvider()
        : new MockProfileDataProvider();
}
